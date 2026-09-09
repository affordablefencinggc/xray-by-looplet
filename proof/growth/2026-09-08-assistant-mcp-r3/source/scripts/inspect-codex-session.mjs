import fs from 'node:fs';
import readline from 'node:readline';

async function main() {
  const fileStream = fs.createReadStream('C:/Users/danie/.codex/sessions/2026/09/07/rollout-2026-09-07T12-47-24-01a079c3-67e5-7240-a90c-77fc9bc4be15.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const userMessages = [];

  for await (const line of rl) {
    if (line.includes('"user_message"') || line.includes('"role":"user"')) {
      try {
        const obj = JSON.parse(line);
        userMessages.push(obj);
      } catch (e) {}
    }
  }

  console.log('Total user messages found:', userMessages.length);
  for (let i = 0; i < userMessages.length; i++) {
    console.log(`=== USER MSG [${i}] ===`);
    console.log(JSON.stringify(userMessages[i], null, 2));
  }
}

main().catch(console.error);
