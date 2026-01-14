/**
 * Persona Command
 * Manage persona definitions
 */

import { listPersonas, personaExists, createPersona, getPersonaPath } from '../core/personas';
import { header, success, error, info } from '../utils/output';
import { COLORS, PERSONAS_DIR } from '../utils/constants';

export async function personaCommand(action: string, name?: string): Promise<void> {
  switch (action) {
    case 'list':
      await listPersonasCmd();
      break;
    case 'new':
      if (!name) {
        error('Usage: trench persona new <name>');
        process.exit(1);
      }
      await newPersonaCmd(name);
      break;
    case 'edit':
      if (!name) {
        error('Usage: trench persona edit <name>');
        process.exit(1);
      }
      await editPersonaCmd(name);
      break;
    default:
      error(`Unknown action: ${action}`);
      info('Usage: trench persona [list|new|edit]');
  }
}

async function listPersonasCmd(): Promise<void> {
  header('Available Personas');

  const personas = listPersonas();

  if (personas.length === 0) {
    info('No personas found.');
    info(`Add personas to: ${PERSONAS_DIR}`);
    return;
  }

  for (const p of personas) {
    console.log(`  ${COLORS.orange}${p.name}${COLORS.reset}`);
    console.log(`  ${COLORS.dim}${p.description}${COLORS.reset}\n`);
  }

  console.log(`${COLORS.dim}Total: ${personas.length} persona(s)${COLORS.reset}`);
  console.log(`${COLORS.dim}Location: ${PERSONAS_DIR}${COLORS.reset}`);
}

async function newPersonaCmd(name: string): Promise<void> {
  if (personaExists(name)) {
    error(`Persona "${name}" already exists.`);
    info(`Edit it with: trench persona edit ${name}`);
    process.exit(1);
  }

  const path = createPersona(name);
  success(`Created persona: ${name}`);
  info(`Edit at: ${path}`);

  // Try to open in editor
  const editor = process.env.EDITOR || 'code';
  try {
    Bun.spawn([editor, path]);
    info(`Opening in ${editor}...`);
  } catch {
    info(`Open manually: ${editor} ${path}`);
  }
}

async function editPersonaCmd(name: string): Promise<void> {
  if (!personaExists(name)) {
    error(`Persona "${name}" not found.`);

    const personas = listPersonas();
    if (personas.length > 0) {
      info('Available personas:');
      for (const p of personas) {
        console.log(`  - ${p.name}`);
      }
    }

    process.exit(1);
  }

  const path = getPersonaPath(name);

  // Try to open in editor
  const editor = process.env.EDITOR || 'code';
  try {
    Bun.spawn([editor, path]);
    success(`Opening ${name} in ${editor}...`);
  } catch {
    info(`Open manually: ${editor} ${path}`);
  }
}
