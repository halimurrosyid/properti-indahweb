const { Anthropic } = require('@anthropic-ai/sdk');

// Helper to safely parse JSON from AI response
const parseAiJson = (text) => {
  let cleaned = text.trim();
  
  // Remove markdown code blocks if any
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '') // remove ```json
                     .replace(/^```\s*/, '')      // remove ```
                     .replace(/\s*```$/, '');     // remove trailing ```
  }
  
  // Find first { and last } to isolate JSON if AI included other text
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned);
};

exports.generateSeoArticle = async (title, knowledgeBase = '', options = {}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
  const defaultWordMin = parseInt(process.env.AI_BLOG_DEFAULT_WORD_MIN, 10) || 900;
  const defaultWordMax = parseInt(process.env.AI_BLOG_DEFAULT_WORD_MAX, 10) || 1500;
  const wordMin = parseInt(options.wordMin, 10) || defaultWordMin;
  const wordMax = parseInt(options.wordMax, 10) || defaultWordMax;
  
  if (!apiKey) {
    throw new Error('API Key Anthropic belum dikonfigurasi di file .env. Silakan hubungi Super Admin.');
  }

  const anthropic = new Anthropic({ apiKey });

  let prompt = `Tulis artikel SEO berbahasa Indonesia untuk website Properti Indahweb dengan judul: "${title}".

Topik utama adalah properti lokal Indonesia, jual beli rumah, sewa rumah, tanah, kontrakan, kos, ruko, apartemen, atau tips properti.

Syarat artikel:
- Bahasa Indonesia natural
- Panjang ${wordMin} sampai ${wordMax} kata
- SEO friendly
- AIO/GEO friendly
- Tidak keyword stuffing
- Tidak berlebihan
- Cocok untuk pembaca Indonesia
- Gunakan struktur H2 dan H3
- Jangan gunakan H1 karena H1 sudah dipakai sebagai judul halaman
- Buat pembukaan yang menarik
- Buat pembahasan lengkap
- Buat FAQ di akhir
- Buat kesimpulan dan CTA halus ke Properti Indahweb
- Jangan membuat klaim palsu
- Jangan mengarang data spesifik yang tidak tersedia
- Jika membahas lokasi, gunakan bahasa umum dan aman
- Output harus berupa JSON valid

Format JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "meta_title": "...",
  "meta_description": "...",
  "focus_keyword": "...",
  "content": "..."
}

Content boleh berisi HTML sederhana:
- <h2>
- <h3>
- <p>
- <ul>
- <ol>
- <li>
- <strong>

Jangan sertakan markdown code block.`;

  if (knowledgeBase && knowledgeBase.trim()) {
    prompt += `\n\nBerikut adalah basis pengetahuan tambahan (Knowledge Base) yang WAJIB Anda gunakan sebagai referensi utama isi artikel:\n---\n${knowledgeBase.trim()}\n---`;
  }

  try {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: Math.min(8000, Math.max(3000, Math.ceil(wordMax * 2.2))),
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;
    
    try {
      const parsedData = parseAiJson(responseText);
      
      // Validate structure
      const requiredFields = ['title', 'slug', 'excerpt', 'content'];
      for (const field of requiredFields) {
        if (!parsedData[field]) {
          throw new Error(`AI response is missing the required field: "${field}"`);
        }
      }
      
      return parsedData;
    } catch (parseError) {
      console.error('[Anthropic JSON Parsing Error]', parseError);
      console.error('[Raw AI Response Text]', responseText);
      throw new Error(`Gagal memproses format data artikel AI: ${parseError.message}`);
    }
  } catch (apiError) {
    console.error('[Anthropic API Error]', apiError);
    throw apiError;
  }
};
