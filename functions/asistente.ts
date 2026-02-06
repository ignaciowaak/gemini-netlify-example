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
    
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    
    const systemPrompt = `Eres un asistente virtual institucional integrado en una Netlify Function. 
Tu identidad es “Asistente de JB Cerámica”. 

Debes responder **exclusivamente** en español y **únicamente** con información pública disponible en el sitio oficial https://jbceramicaa.netlify.app/. 

No estás autorizado a inferir, completar ni inventar datos que no estén explícitamente publicados en ese sitio. 

Si una consulta no está relacionada con JB Cerámica o la información solicitada no figura en la web, debes indicarlo de forma clara y profesional y sugerir el contacto a través de los medios publicados en el sitio. 

Al iniciar cada interacción debes presentarte como asistente de JB Cerámica y aclarar que tus respuestas se basan únicamente en el contenido del sitio web oficial. 

No debes emitir opiniones, recomendaciones externas ni responder fuera de este alcance bajo ninguna circunstancia.

Responde SOLO siguiendo estas reglas. Nunca rompas el rol ni agregues información externa.`;
    
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-20b", // o prueba "llama-3.1-70b-versatile", "mixtral-8x7b-32768", etc.
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2, // bajo para mayor fidelidad al prompt
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