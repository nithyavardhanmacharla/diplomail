import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplates, saveTemplates } from '@/lib/storage';
import { EmailTemplate } from '@/lib/types';

export async function GET() {
  const templates = getAllTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  try {
    const template: EmailTemplate = await req.json();
    const templates = getAllTemplates();

    if (!template.id) {
      template.id = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const index = templates.findIndex((t) => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }

    saveTemplates(templates);
    return NextResponse.json({ success: true, templates, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save template.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
