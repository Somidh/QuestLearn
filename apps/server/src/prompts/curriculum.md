Turn the learner's goal into 6 to 10 ordered checkpoints, from first principles to applied skill.

Each checkpoint teaches one idea and builds on the one before it.

Return JSON in this shape:

{
  "summary": "One or two sentences on how the road is structured.",
  "checkpoints": [
    {
      "title": "Short title, at most 40 characters",
      "summary": "One sentence on what the learner will understand.",
      "difficulty": 1,
      "icon": "compass"
    }
  ]
}

"difficulty" is a whole number from 1 (easiest) to 5 (hardest), and should rise along the road.

"icon" must be one of: compass, book, gear, server, database, network, bolt, shield, layers, code, chart, puzzle, flask, globe, lock, flag.

The last checkpoint is an applied project or capstone, with the icon "flag".
