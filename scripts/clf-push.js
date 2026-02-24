#!/usr/bin/env node

/**
 * CodeLove Git Bridge — CLI Task Creator
 *
 * Usage:
 *   node scripts/clf-push.js "Corrigir bug de login"
 *   node scripts/clf-push.js "Adicionar validação de email" --priority high
 *
 * This script:
 *   1. Creates a .md task file in .lovable/tasks/
 *   2. Commits the file
 *   3. Pushes to origin (triggering the GitHub Action)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Parse arguments ───
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
⚡ CodeLove Git Bridge — CLI Task Creator

Uso:
  node scripts/clf-push.js "Descrição da tarefa"
  node scripts/clf-push.js "Descrição da tarefa" --priority high

Opções:
  --priority <low|medium|high>   Prioridade da tarefa (padrão: medium)
  --help, -h                     Mostrar esta ajuda

Exemplo:
  node scripts/clf-push.js "Corrigir bug de login após OAuth"
  node scripts/clf-push.js "Adicionar página de FAQ" --priority low
`);
  process.exit(0);
}

// Extract task description and priority
let taskDescription = "";
let priority = "medium";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--priority" && args[i + 1]) {
    priority = args[i + 1];
    i++; // skip next
  } else {
    taskDescription += (taskDescription ? " " : "") + args[i];
  }
}

if (!taskDescription.trim()) {
  console.error("❌ Erro: Descrição da tarefa não pode ser vazia.");
  process.exit(1);
}

// ─── Ensure .lovable/tasks/ directory exists ───
const tasksDir = path.join(process.cwd(), ".lovable", "tasks");
if (!fs.existsSync(tasksDir)) {
  fs.mkdirSync(tasksDir, { recursive: true });
}

// ─── Generate task filename ───
const now = new Date();
const timestamp = now
  .toISOString()
  .replace(/[:\-T]/g, "")
  .slice(0, 14);
const slug = taskDescription
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 40);
const filename = `${timestamp}-${slug}.md`;
const filepath = path.join(tasksDir, filename);

// ─── Create task content ───
const content = `---
status: pending
priority: ${priority}
created: ${now.toISOString()}
---

## Tarefa

${taskDescription}

---

*Criado via CLI: \`node scripts/clf-push.js\`*
`;

fs.writeFileSync(filepath, content, "utf-8");
console.log(`📄 Task criada: .lovable/tasks/${filename}`);

// ─── Git add, commit, push ───
try {
  const relativePath = path.relative(process.cwd(), filepath).replace(/\\/g, "/");

  execSync(`git add "${relativePath}"`, { stdio: "inherit" });
  execSync(`git commit -m "task: ${taskDescription.slice(0, 60)}"`, {
    stdio: "inherit",
  });
  execSync("git push", { stdio: "inherit" });

  console.log("");
  console.log("✅ Task enviada! O GitHub Action vai processar automaticamente.");
  console.log(`   📁 ${relativePath}`);
  console.log("   🔄 Acompanhe em: GitHub → Actions");
} catch (err) {
  console.error("❌ Erro no git:", err.message);
  console.log(`\n💡 O arquivo foi criado em: .lovable/tasks/${filename}`);
  console.log("   Faça o commit e push manualmente:");
  console.log(`   git add .lovable/tasks/${filename} && git commit -m "task: ..." && git push`);
  process.exit(1);
}
