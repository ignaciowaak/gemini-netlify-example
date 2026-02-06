import OpenAI from "openai";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  try {
    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Falta el campo 'prompt'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // --- NUEVO: recupera y limpia el contenido público del sitio ---
    // Cambiá la URL si necesitás otra.
    const SITE_URL = "https://jbceramicaa.netlify.app/";
    
    async function fetchSiteText(url: string, maxChars = 20000) {
      try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) return `ERROR_AL_DESCARGAR_SITIO: ${res.status}`;
        let html = await res.text();
        
        // eliminar scripts y estilos
        html = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
        html = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
        
        // quitar tags y dejar texto plano
        let text = html.replace(/<\/?[^>]+(>|$)/g, " ");
        // colapsar espacios y cortar a maxChars
        text = text.replace(/\s+/g, " ").trim();
        if (text.length > maxChars) text = text.slice(0, maxChars) + " ...[TRUNCADO]";
        return text || "SIN_TEXTO_EXTRAÍDO";
      } catch (e: any) {
        return `ERROR_AL_DESCARGAR_SITIO: ${String(e.message || e)}`;
      }
    }
    
    const siteText = await fetchSiteText(SITE_URL, 20000);
    // --- FIN: extracción de sitio ---
    
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    
    // --- SISTEMA: prompt mejorado para el modelo ---
    const systemPrompt = `Eres el asistente institucional "Asistente de JB Cerámica".
- Responde **solo en español**.
- Usa **ÚNICAMENTE** la información pública extraída del sitio oficial (esta info se te provee en el siguiente mensaje del sistema).
- No inferir ni inventar datos que no estén presentes en esa información.
- Si la información solicitada NO figura en el sitio, indícalo de forma clara y profesional y sugiere usar los medios de contacto publicados en la web.
- No saludes ni uses frases de cortesía innecesarias; responde directo y conciso.
- Cuando necesites aclaración, **haz preguntas cortas** (máx. 10 palabras).
- No incluyas ni pegues la URL en las respuestas.
- No des opiniones externas ni recomendaciones fuera de la web oficial.`;
    
    // Se agrega otro mensaje de sistema con el texto extraído del sitio.
    const siteSystemMessage = `EXTRACTO_WEB (texto extraído automáticamente de la web oficial):
${siteText}`;
    
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: siteSystemMessage },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim() ||
      "No se pudo generar una respuesta en este momento.";
    
    return new Response(
      JSON.stringify({ response: responseText }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en Groq:", error);
    return new Response(
      JSON.stringify({
        error: "Error al procesar la consulta",
        details: error.message || String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};