import fetch from 'node-fetch';
import OpenAI from 'openai';

// Normalize common env issues for OpenAI API key
try {
  if (process.env.OPENAI_API_KEY && /^\s*export\s+/i.test(process.env.OPENAI_API_KEY)) {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY.replace(/^\s*export\s+/i, '').trim();
  }
  // Accept Vite-style keys as fallback
  if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY.trim();
  }
  if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_KEY) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_KEY.trim();
  }
} catch {}

// OpenAI SDK client per user request — lazily instantiate after env is loaded
let __openaiClient = null;
export function getOpenAIClient() {
  if (!__openaiClient) {
    __openaiClient = new OpenAI();
  }
  return __openaiClient;
}

// Simple LLM provider abstraction:
// - openai: uses Chat Completions
// - ollama: calls local Ollama server /api/chat (recommended if you want to avoid API keys)

export async function chat(messages, {
  provider,
  model,
  temperature = 0.9,
  max_tokens
} = {}) {
  const envProvider = provider || process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama');
  if (envProvider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY || '';
    if (!key) throw new Error('LLM provider set to openrouter but OPENROUTER_API_KEY is missing');
    const modelName = model || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        // Optional but recommended headers per OpenRouter best practices
        'HTTP-Referer': process.env.OPENROUTER_SITE || 'http://localhost:8888',
        'X-Title': process.env.OPENROUTER_TITLE || 'Language Game'
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      throw new Error(`OpenRouter chat failed: ${r.status} ${t.slice(0, 300)}`);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { provider: 'openrouter', content };
  }
  if (envProvider === 'openai') {
    // The OpenAI SDK reads OPENAI_API_KEY from env; ensure it's present
    if (!process.env.OPENAI_API_KEY) throw new Error('LLM provider set to openai but OPENAI_API_KEY is missing');
    const primaryModel = model || process.env.OPENAI_MODEL || 'gpt-5-mini';
    let content = '';
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: primaryModel,
        messages,
        temperature,
        max_tokens
      });
      content = completion?.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      // Graceful fallback if the model isn't available in the org
      const msg = String(e?.message || e || '');
      const forbidden = /must be verified|not found|unsupported model|404/i.test(msg);
      if (forbidden) {
        const fallbackModel = 'gpt-4o-mini';
        const completion2 = await getOpenAIClient().chat.completions.create({
          model: fallbackModel,
          messages,
          temperature,
          max_tokens
        });
        content = completion2?.choices?.[0]?.message?.content ?? '';
      } else {
        throw e;
      }
    }
    return { provider: 'openai', content };
  }

  // Default: Ollama local server
  if (envProvider === 'ollama') {
    const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
    const ollamaModel = model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
    // Convert OpenAI-like messages to Ollama format
    try {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
          options: { temperature }
        })
      });
      if (!r.ok) {
        const t = await r.text().catch(()=> '');
        throw new Error(`Ollama chat failed: ${r.status} ${t.slice(0, 300)}`);
      }
      const data = await r.json();
      // Ollama returns { message: { content } }
      const content = data?.message?.content ?? data?.messages?.[0]?.content ?? '';
      return { provider: 'ollama', content };
    } catch (e) {
      // Fallback to mock for dev if Ollama is unreachable
      console.warn('Ollama unavailable, falling back to mock provider:', e?.message || e);
      return { provider: 'mock', content: '' };
    }
  }

  // Explicit mock provider (dev only)
  return { provider: 'mock', content: '' };
}

export function currentProvider() {
  return process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama');
}
