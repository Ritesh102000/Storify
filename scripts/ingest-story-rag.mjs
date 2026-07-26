import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OpenAI, { toFile } from "openai";

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, "knowledge/source-manifest.json");
const cacheDir = path.join(projectRoot, "knowledge/.cache/sources");
const archiveDir = path.join(projectRoot, "knowledge/private-archive");
const resultPath = path.join(projectRoot, "knowledge/ingestion-result.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const phases = [
  "opening",
  "choice_consequence",
  "relationship_dialogue",
  "escalation",
  "reversal",
  "crisis_resolution",
];
const phasePatterns = {
  opening:
    "Open inside an unstable situation with one physical objective, one endangered relationship, and one person who can be challenged. Make every available action save something different and endanger something concrete.",
  choice_consequence:
    "Begin with the selected action succeeding in a limited way, then make its anticipated tradeoff irreversible. The next lead must emerge from that exact consequence rather than from coincidence.",
  relationship_dialogue:
    "Let one character name what the listener chose while another disputes its meaning. Each reply must answer the preceding line, expose incompatible goals, and create an action the listener can take.",
  escalation:
    "Turn a stored clue or earlier cost into an obstacle that moves against the listener. Raise stakes by narrowing time, safety, or trust while preserving a credible path forward.",
  reversal:
    "Introduce corroborated evidence that keeps prior facts true but changes their interpretation. The reversal should complicate loyalty or motive, not replace the established conflict with an unrelated surprise.",
  crisis_resolution:
    "Bring two established values into direct conflict. Resolve the active question through accumulated evidence and the listener's action, then show a permanent change in the world and one relationship.",
};
const lenses = {
  blackmoor: [
    "Use a promise that becomes costly when the environment changes.",
    "Let an apparently useful artifact impose a social or ecological price.",
    "Make travel reveal competing communities rather than serve as empty transition.",
    "Allow an old rule to become newly relevant through a character's action.",
    "Use a rival's practical argument to challenge a loyal relationship.",
    "Make wonder and danger emerge from the same world rule.",
  ],
  neon_afterlight: [
    "Separate personal testimony from physical evidence and let them disagree.",
    "Make a technology solve one problem while damaging identity or trust.",
    "Use asymmetric knowledge so a character can be truthful but incomplete.",
    "Let an institution react strategically to the listener's specific evidence.",
    "Make a timeline inconsistency become actionable rather than merely strange.",
    "Resolve truth through accountability, not through discovering a perfect original.",
  ],
  monsoon_house: [
    "Let a domestic object carry evidence that contradicts family habit.",
    "Make a supernatural rule behave consistently during emotional conflict.",
    "Use repeated speech as evidence while preserving the limit that it cannot answer.",
    "Let care and denial exist in the same character without making either false.",
    "Make the building physically express an unresolved family relationship.",
    "Resolve remembrance through shared responsibility rather than simple exposure.",
  ],
};
const sourceCharacterNames = {
  pg_701: ["gluck", "schwartz", "hans"],
  pg_708: ["irene", "curdie", "lootie"],
  pg_1727: ["odysseus", "telemachus", "penelope", "athena"],
  pg_765: ["goodwin", "throckmartin", "lakla", "olaf"],
  pg_8395: ["mana", "skarl", "slid", "mung"],
  pg_139: ["challenger", "malone", "roxton", "summerlee"],
  pg_84: ["frankenstein", "victor", "elizabeth", "clerval"],
  pg_43: ["jekyll", "hyde", "utterson", "lanyon"],
  pg_35: ["weena", "filby"],
  pg_624: ["west", "leete", "edith"],
  pg_201: ["square", "sphere", "hexagon"],
  pg_5230: ["griffin", "kemp", "marvel"],
  pg_2806: ["jack", "agnes", "pansay"],
  pg_77: ["pyncheon", "hepzibah", "clifford", "phoebe"],
  pg_14522: ["canterville", "otis", "virginia"],
  pg_209: ["miles", "flora", "quint", "jessel"],
  pg_932: ["usher", "roderick", "madeline"],
  pg_1952: ["john", "jennie"],
};

await mkdir(cacheDir, { recursive: true });
await mkdir(archiveDir, { recursive: true });
const sourceRecords = [];
const sources = new Map();
for (const source of manifest) {
  const response = await fetch(source.text_url, {
    headers: { "User-Agent": "PocketMultiverseHackathon/2.0" },
  });
  if (!response.ok) {
    throw new Error(`Download failed for ${source.source_id}: ${response.status}`);
  }
  const text = await response.text();
  if (
    text.length < 10_000 ||
    !text.toLowerCase().includes("project gutenberg") ||
    !text.includes(String(source.gutenberg_id))
  ) {
    throw new Error(`Source identity check failed for ${source.source_id}`);
  }
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (source.expected_sha256 && source.expected_sha256 !== sha256) {
    throw new Error(`Hash mismatch for ${source.source_id}`);
  }
  const filename = `${source.source_id}.txt`;
  await writeFile(path.join(cacheDir, filename), text, "utf8");
  sources.set(source.source_id, text);
  sourceRecords.push({
    source_id: source.source_id,
    title: source.title,
    sha256,
    bytes: Buffer.byteLength(text),
    rights_basis: source.rights_basis,
    territory_review: source.territory_review,
    source_url: source.source_url,
  });
}
await writeFile(
  path.join(archiveDir, "source-records.json"),
  JSON.stringify(sourceRecords, null, 2),
);

const cards = manifest.flatMap((source, sourceIndex) =>
  phases.map((storyPhase, phaseIndex) => ({
    template_id: source.template_id,
    doc_type: "craft",
    card_id: `${source.source_id}_${storyPhase}`,
    source_id: source.source_id,
    source_title: source.title,
    story_phase: storyPhase,
    scene_function: `${storyPhase.replaceAll("_", "-")}-with-causal-change`,
    pattern: `${phasePatterns[storyPhase]} ${
      lenses[source.template_id][(sourceIndex + phaseIndex) % 6]
    }`,
    content_rating: "family_safe",
  })),
);

for (const card of cards) {
  const source = manifest.find((item) => item.source_id === card.source_id);
  const sourceText = sources.get(card.source_id);
  if (!source || !sourceText) throw new Error(`Missing source for ${card.card_id}`);
  assertSanitized(card, source, sourceText);
}

if (!process.argv.includes("--upload")) {
  process.stdout.write(
    `${JSON.stringify({ sources: sourceRecords, craft_card_count: cards.length }, null, 2)}\n`,
  );
  process.exit(0);
}

await loadLocalEnv();
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required for --upload.");
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const vectorStore = await client.vectorStores.create({
  name: "Pocket Multiverse Story Craft v2",
  description:
    "Private public-domain source archive plus sanitized abstract craft cards. Runtime searches craft cards only.",
  metadata: { project: "pocket_multiverse", schema_version: "2" },
});

let sourceUploads = 0;
await mapLimit(manifest, 6, async (source) => {
  const text = sources.get(source.source_id);
  const uploaded = await client.files.create({
    file: await toFile(Buffer.from(text), `${source.source_id}.txt`),
    purpose: "user_data",
  });
  await client.vectorStores.files.createAndPoll(vectorStore.id, {
    file_id: uploaded.id,
    attributes: {
      template_id: source.template_id,
      doc_type: "source",
      source_id: source.source_id,
      content_rating: "family_safe",
    },
  });
  sourceUploads += 1;
  process.stdout.write(`Uploaded source ${sourceUploads}/${manifest.length}\n`);
});

let craftUploads = 0;
await mapLimit(cards, 8, async (card) => {
  const body = [
    `card_id: ${card.card_id}`,
    `story_phase: ${card.story_phase}`,
    `scene_function: ${card.scene_function}`,
    `pattern: ${card.pattern}`,
  ].join("\n");
  const uploaded = await client.files.create({
    file: await toFile(Buffer.from(body), `${card.card_id}.txt`),
    purpose: "user_data",
  });
  await client.vectorStores.files.createAndPoll(vectorStore.id, {
    file_id: uploaded.id,
    attributes: {
      template_id: card.template_id,
      doc_type: "craft",
      source_id: card.source_id,
      card_id: card.card_id,
      story_phase: card.story_phase,
      scene_function: card.scene_function,
      content_rating: card.content_rating,
    },
  });
  craftUploads += 1;
  if (craftUploads % 12 === 0 || craftUploads === cards.length) {
    process.stdout.write(`Uploaded craft cards ${craftUploads}/${cards.length}\n`);
  }
});

const expectedFileCount = manifest.length + cards.length;
let completed = 0;
for (let attempt = 0; attempt < 10; attempt += 1) {
  completed = await countCompletedFiles(client, vectorStore.id);
  if (completed === expectedFileCount) break;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
if (completed !== expectedFileCount) {
  throw new Error(
    `Vector store verification failed: ${completed}/${expectedFileCount} files completed.`,
  );
}
const result = {
  vector_store_id: vectorStore.id,
  source_count: manifest.length,
  craft_card_count: cards.length,
  completed_file_count: completed,
  source_hashes: Object.fromEntries(
    sourceRecords.map((item) => [item.source_id, item.sha256]),
  ),
  created_at: new Date().toISOString(),
};
await writeFile(resultPath, JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function assertSanitized(card, source, sourceText) {
  const normalizedPattern = normalize(card.pattern);
  const leakedName = (sourceCharacterNames[source.source_id] ?? []).find((name) =>
    normalizedPattern.split(" ").includes(name),
  );
  if (
    leakedName ||
    normalizedPattern.includes(normalize(source.title)) ||
    normalizedPattern.includes(normalize(source.author))
  ) {
    throw new Error(`Source name leaked into ${card.card_id}`);
  }
  const words = normalizedPattern.split(" ");
  const sourceNormalized = ` ${normalize(sourceText)} `;
  for (let index = 0; index <= words.length - 8; index += 1) {
    const phrase = ` ${words.slice(index, index + 8).join(" ")} `;
    if (sourceNormalized.includes(phrase)) {
      throw new Error(`Eight-word source overlap in ${card.card_id}`);
    }
  }
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadLocalEnv() {
  const filename = path.join(projectRoot, ".env");
  return readFile(filename, "utf8")
    .then((contents) => {
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    })
    .catch(() => undefined);
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
}

async function countCompletedFiles(client, vectorStoreId) {
  let count = 0;
  for await (const file of client.vectorStores.files.list(vectorStoreId, {
    filter: "completed",
    limit: 100,
  })) {
    if (file.status === "completed") count += 1;
  }
  return count;
}
