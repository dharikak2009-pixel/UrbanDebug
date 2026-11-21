const CATS = ["Potholes / Road damage", "Garbage / Waste", "Streetlights", "Water problems",
  "Drainage / Sewage", "Traffic / Signals", "Parks / Public spaces", "Other"];
const PRI = ["Low", "Medium", "High"];
const DEPTS = ["Roads & Highways", "Solid Waste Management", "Electricity & Street Lighting", "Water Supply Board",
  "Drainage & Sewerage", "Traffic & Transport", "Parks & Horticulture", "General Administration"];
const clip = (v, n) => String(v || "").slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI is not configured", configured: false });
  try {
    const b = req.body || {};
    const title = clip(b.title, 120), desc = clip(b.desc, 1500), city = clip(b.city, 80), area = clip(b.area, 120), cat = clip(b.cat, 60);
    if (!desc) return res.status(400).json({ error: "Description is required" });
    const parts = [{ text:
`You triage civic complaints for a city municipal corporation.
Title: ${title}
Description: ${desc}
City: ${city}
Area or landmark: ${area}
Category chosen by the citizen (may be wrong or empty): ${cat || "none"}

Pick the best category and the department that handles it.
Priority from urgency and public impact, using only Low, Medium or High:
High = immediate danger or serious safety or health risk, or many people affected (live wires, open manholes, flooding, outages near schools or hospitals);
Medium = a real inconvenience that needs attention soon; Low = minor or cosmetic.
summary: one clear sentence for officials. reason: one short sentence explaining why you chose that priority. If a photo is attached, use it.` }];
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(b.image || "");
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING", enum: CATS },
              priority: { type: "STRING", enum: PRI },
              department: { type: "STRING", enum: DEPTS },
              summary: { type: "STRING" },
              reason: { type: "STRING" }
            },
            required: ["category", "priority", "department", "summary", "reason"]
          }
        }
      })
    });
    if (!r.ok) return res.status(502).json({ error: "Gemini request failed" });
    const data = await r.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;
    const out = JSON.parse(text);
    if (!CATS.includes(out.category) || !PRI.includes(out.priority)) return res.status(502).json({ error: "Unexpected AI response" });
    if (!DEPTS.includes(out.department)) out.department = DEPTS[CATS.indexOf(out.category)];
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Analysis failed" });
  }
};
