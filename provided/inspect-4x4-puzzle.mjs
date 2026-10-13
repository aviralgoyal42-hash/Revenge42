import { puzzles } from "cubing/puzzles";

const kpuzzle = await puzzles["4x4x4"].kpuzzle();
console.log("Puzzle name:", kpuzzle.definition.name);
console.log("Orbits:", Object.keys(kpuzzle.definition.orbits));
for (const [name, orbit] of Object.entries(kpuzzle.definition.orbits)) {
  console.log(` - ${name}: numPieces=${orbit.numPieces}, numOrientations=${orbit.numOrientations}`);
}

const start = kpuzzle.defaultPattern();
console.log("\nDefault (solved) patternData sample:");
console.log(JSON.stringify(start.patternData, null, 1).slice(0, 800));

console.log("\nAvailable moves:", kpuzzle.definition.moves ? Object.keys(kpuzzle.definition.moves).slice(0, 40) : "see experimentalAllMoves");
