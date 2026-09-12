import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { checkEmergencyGuardrails, sanitizeUserInput } from "./safetyGuardrails.ts";

export const NYAY_SARTHI_SYSTEM_INSTRUCTION = `You are "Nyay Sarthi Assistant" (न्याय सारथी), a concise, empathetic, and highly structured legal-information guide for Indian citizens. You explain Indian laws, legal procedures, citizen rights, and remedies in clear, brief, and punchy language (in English and Hindi as requested). You are not a licensed advocate.

Key Response Guidelines:
1. **Brevity & High Signal**: Be brief and concise. Avoid long-winded essays, boilerplate fluff, and overly repetitive text. Focus on actionable insights that a citizen can read and act upon in 60 seconds.
2. **Highlight Main Topics & Statutory Rules**:
   - Explicitly highlight the primary legal category and main issue right at the top.
   - Use bold highlights (\`**Section 173 BNSS (Zero FIR)**\`, \`**e-Daakhil Portal**\`, \`**1930 Cyber Helpline**\`) for key terms, statutory provisions, and time limits.
3. **Structured & Scannable Markdown Format**:
   Always format your answer using the following 4-5 compact, emoji-labeled blocks:

### 🏷️ Main Topic: [Identified Legal Issue / Category]
**Direct Answer:** [1-2 clear, reassuring sentences answering the user's situation directly].

---

### ⚖️ Key Legal Rights & Statutory Provisions
* 📜 **[Act / Section]**: [1-line explanation of citizen right or protection]
* 🛡️ **[Right/Entitlement]**: [1-line explanation of what the other party cannot legally do]

---

### 📋 3-Step Action Checklist
* 1️⃣ **Immediate Step:** [Direct action to take today]
* 2️⃣ **Documentation & Notice:** [Key evidence to preserve and legal notice/complaint]
* 3️⃣ **Escalation & Filing:** [Where to file if unresolved within statutory window]

---

### 🏛️ Forum & Official Helplines
* 🌐 **Online Portal / Forum:** [e.g. e-Daakhil / cybercrime.gov.in / RTI Online / District Court DLSA]
* 📞 **Helpline:** [e.g. Cyber 1930 | Consumer 1915 | NALSA Free Legal Aid 15100 | Women 181]

---
*ℹ️ Educational legal guidance under Indian law. Consult a registered advocate or DLSA clinic for courtroom representation.*`;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

export function getModelConfig() {
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const temperature = parseFloat(process.env.GEMINI_TEMPERATURE || '0.3');
  return {
    model,
    temperature: isNaN(temperature) ? 0.3 : Math.min(Math.max(temperature, 0.0), 1.0)
  };
}

function getValidModelCascade(requestedModel?: string): string[] {
  const primary = requestedModel || 'gemini-3.8-flash';
  const candidates = [primary, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  return Array.from(new Set(candidates.filter(Boolean)));
}

function cleanJsonText(raw: string): string {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Format conversation history into contents for Gemini
 */
function buildGeminiContents(params: {
  message: string;
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  language?: 'en' | 'hi';
  citizenContext?: { name?: string; state?: string; city?: string };
}) {
  const { message, history = [], language = 'en', citizenContext } = params;
  const sanitizedMessage = sanitizeUserInput(message);

  const contextHeader = citizenContext ? `[Citizen Profile: ${citizenContext.name || 'User'}, Location: ${[citizenContext.city, citizenContext.state].filter(Boolean).join(', ') || 'India'}]\n` : '';
  const languageDirective = language === 'hi' ? `[Preferred Language: Hindi (हिंदी). Please respond in clear, empathetic Hindi with legal terms explained.]\n` : `[Preferred Language: English (with Hindi legal terms where helpful)]\n`;

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Add last 8 turns of context
  const recentHistory = history.slice(-8);
  for (const turn of recentHistory) {
    if (!turn.text) continue;
    contents.push({
      role: turn.sender === 'user' ? 'user' : 'model',
      parts: [{ text: sanitizeUserInput(turn.text) }]
    });
  }

  // Current turn with user profile & language tags
  contents.push({
    role: 'user',
    parts: [{ text: `${contextHeader}${languageDirective}${sanitizedMessage}` }]
  });

  return contents;
}

/**
 * Local fallback legal intelligence when all remote Gemini endpoints are unavailable (e.g., during 503 high-demand spikes)
 */
function generateLocalLegalResponse(message: string, language: 'en' | 'hi' = 'en'): {
  text: string;
  category: string;
  rights: string[];
  nextSteps: string[];
  authority: string;
  legalAid: string;
} {
  const q = (message || '').toLowerCase();
  let category = 'General Legal Consultation';
  let understanding = 'Your situation involves statutory rights and procedural remedies under Indian law.';
  let rights = [
    'Constitutional right to equal protection of laws under Article 14 & Article 21.',
    'Right to statutory remedy through competent district civil/criminal courts or regulatory tribunals.'
  ];
  let nextSteps = [
    'Preserve all relevant documentary, digital, and financial records with timestamps.',
    'Send a formal, documented communication (registered post or email) stating your grievance.',
    'If unaddressed within 15 days, escalate to the competent statutory forum or DLSA clinic.'
  ];
  let authority = 'District Legal Services Authority (DLSA) / Competent Civil Court';
  let legalAid = 'NALSA National Helpline: 15100 (Toll-Free, 24x7)';

  if (q.includes('deposit') || q.includes('landlord') || q.includes('rent') || q.includes('tenant') || q.includes('evict') || q.includes('किराया') || q.includes('मकान मालिक')) {
    category = 'Tenancy & Property Dispute';
    understanding = 'You are seeking recovery of a withheld security deposit or protection against unlawful eviction under tenancy laws.';
    rights = [
      'Model Tenancy Act / State Rent Control Act: Security deposit must be refunded after lawful deductions within 30 days of vacating.',
      'Protection against arbitrary eviction without a statutory notice or formal order from the Rent Authority.',
      'Prohibition on cutting essential utility supplies (water, electricity) by the landlord.'
    ];
    nextSteps = [
      'Issue a formal 15-day Legal Demand Notice for refund of the security deposit with bank details.',
      'File an application before the local Rent Authority / Rent Tribunal under the Model Tenancy Act.',
      'If landlord disputes, file a civil summary suit under Order XXXVII of the CPC for debt recovery.'
    ];
    authority = 'Rent Authority / Rent Court / District Civil Court';
  } else if (q.includes('cyber') || q.includes('fraud') || q.includes('upi') || q.includes('hacked') || q.includes('otp') || q.includes('scam') || q.includes('साइबर') || q.includes('धोखाधड़ी')) {
    category = 'Cyber Crime & Financial Fraud';
    understanding = 'You are reporting unauthorized digital transactions, online fraud, or cyber theft.';
    rights = [
      'RBI Circular 2017 (Zero Liability): Zero customer liability if unauthorized transaction reported to bank within 3 days.',
      'Section 66D Information Technology Act, 2000 (Cheating by personation using computer resource).',
      'Golden Hour Protocol: Immediate freeze of beneficiary bank account via National Cyber Crime Helpline 1930.'
    ];
    nextSteps = [
      'Call 1930 (Cyber Fraud Helpline) within the golden hour to initiate automated transaction freeze.',
      'File an official complaint on cybercrime.gov.in and obtain an acknowledgement number.',
      'Submit written zero-liability dispute form along with FIR copy to your bank branch within 72 hours.'
    ];
    authority = 'National Cyber Crime Reporting Portal (cybercrime.gov.in) & District Cyber Cell';
    legalAid = 'Cyber Helpline: 1930 | NALSA: 15100';
  } else if (q.includes('consumer') || q.includes('refund') || q.includes('defective') || q.includes('warranty') || q.includes('seller') || q.includes('सामान') || q.includes('रिफंड')) {
    category = 'Consumer Protection Dispute';
    understanding = 'You are facing defective product issues, unfair trade practices, or refusal of lawful refund.';
    rights = [
      'Consumer Protection Act, 2019: Right to replacement, refund, and compensation for deficiency in service.',
      'Product liability provisions under Section 84 against manufacturer and e-commerce platform.',
      'Right to file online complaint from anywhere in India via e-Daakhil without physical presence.'
    ];
    nextSteps = [
      'Call National Consumer Helpline (1915) or register grievance on consumerhelpline.gov.in.',
      'Issue a 15-day formal Legal Notice to the merchant and corporate support.',
      'If unresolved, file an e-complaint on edaakhil.nic.in seeking refund plus damages.'
    ];
    authority = 'District Consumer Disputes Redressal Commission / e-Daakhil';
    legalAid = 'National Consumer Helpline: 1915 | NALSA: 15100';
  } else if (q.includes('police') || q.includes('fir') || q.includes('arrest') || q.includes('थाना') || q.includes('गिरफ्तार')) {
    category = 'Criminal Law & Police Procedure';
    understanding = 'You are inquiring about FIR registration rights, Zero FIR, or police complaints under the Bharatiya Nagarik Suraksha Sanhita (BNSS).';
    rights = [
      'Section 173 BNSS: Mandatory registration of FIR for cognizable offences; Zero FIR can be lodged at any police station in India.',
      'Section 173(2) BNSS: Right to receive a certified copy of the registered FIR free of cost immediately.',
      'Section 35 BNSS: Prior notice required before arrest for offences punishable with imprisonment up to 7 years.'
    ];
    nextSteps = [
      'Submit a typed written complaint in duplicate at the local station and insist on a stamped receipt/acknowledgement.',
      'If police refuse, send the complaint by registered post to the Superintendent of Police (SP/DCP) under Sec 173(3) BNSS.',
      'File an application under Section 175(3) BNSS before the Judicial Magistrate for court-monitored FIR.'
    ];
    authority = 'Area Police Station / Superintendent of Police / Judicial Magistrate Court';
    legalAid = 'Police Emergency: 112 | NALSA: 15100';
  } else if (q.includes('salary') || q.includes('job') || q.includes('wages') || q.includes('termination') || q.includes('employer') || q.includes('वेतन') || q.includes('नौकरी')) {
    category = 'Labour & Employment Dispute';
    understanding = 'You are seeking recovery of unpaid salary, notice pay, or statutory dues following employment separation.';
    rights = [
      'Payment of Wages Act & Code on Wages: Right to timely payment without arbitrary deductions.',
      'Right to statutory notice period salary and full & final settlement clearance within 30 days.',
      'Payment of Gratuity Act: Mandatory gratuity for continuous service of 5 or more years.'
    ];
    nextSteps = [
      'Send a formal Demand Letter to HR and Company Directors demanding dues within 15 days.',
      'File a recovery claim before the Deputy Labour Commissioner / Labour Officer.',
      'If company fails to settle, initiate legal proceedings before the Labour Court / Civil Court.'
    ];
    authority = 'Office of the Labour Commissioner / Industrial & Labour Court';
  }

  const text = language === 'hi'
    ? `### 🏷️ मुख्य विषय: ${category}
**प्रत्यक्ष समाधान:** ${understanding}

---

### ⚖️ प्रमुख कानूनी अधिकार व धाराएं
${rights.map(r => `* 📜 **कानूनी प्रावधान:** ${r}`).join('\n')}

---

### 📋 3-चरणीय कार्ययोजना
${nextSteps.map((s, idx) => `* ${idx + 1}️⃣ **चरण ${idx + 1}:** ${s}`).join('\n')}

---

### 🏛️ फोरम एवं आधिकारिक हेल्पलाइन
* 🌐 **सक्षम प्राधिकरण:** ${authority}
* 📞 **विधिक सहायता:** ${legalAid}

---
*ℹ️ यह सामान्य विधिक मार्गदर्शन है। न्यायालयीन प्रतिनिधित्व हेतु DLSA अथवा पंजीकृत अधिवक्ता से परामर्श करें।*`
    : `### 🏷️ Main Topic: ${category}
**Direct Summary:** ${understanding}

---

### ⚖️ Key Legal Rights & Statutory Provisions
${rights.map(r => `* 📜 **Statutory Provision:** ${r}`).join('\n')}

---

### 📋 3-Step Action Checklist
${nextSteps.map((s, idx) => `* ${idx + 1}️⃣ **Step ${idx + 1}:** ${s}`).join('\n')}

---

### 🏛️ Forum & Official Helplines
* 🌐 **Competent Forum:** ${authority}
* 📞 **Helpline:** ${legalAid}

---
*ℹ️ Educational legal guidance under Indian law. Consult a registered advocate or DLSA legal clinic for courtroom representation.*`;

  return { text, category, rights, nextSteps, authority, legalAid };
}

/**
 * Stream conversational chat response token-by-token
 */
export async function streamChatResponse(
  params: {
    message: string;
    history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
    language?: 'en' | 'hi';
    citizenContext?: { name?: string; state?: string; city?: string };
  },
  onChunk: (chunkText: string) => void
): Promise<string> {
  const { model, temperature } = getModelConfig();
  const ai = getGenAI();
  const contents = buildGeminiContents(params);

  // Model cascade prioritizing active models
  const uniqueModels = getValidModelCascade(model);

  let fullAccumulatedText = '';
  let lastError: any = null;

  for (const currentModel of uniqueModels) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: currentModel,
        contents,
        config: {
          systemInstruction: NYAY_SARTHI_SYSTEM_INSTRUCTION,
          temperature,
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullAccumulatedText += text;
          onChunk(text);
        }
      }

      if (fullAccumulatedText.trim()) {
        return fullAccumulatedText;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || JSON.stringify(err);
      const isTransient = err?.status === 503 || err?.code === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429');
      
      console.warn(`Streaming attempt on ${currentModel} encountered (${isTransient ? 'transient' : 'error'}):`, errMsg);
      if (isTransient) {
        // Quick pause and try next fallback model
        await new Promise((res) => setTimeout(res, 250));
      }
    }
  }

  // Graceful fallback to local structured legal engine so stream never crashes
  console.warn('Falling back to local statutory intelligence engine for streaming response...');
  const fallback = generateLocalLegalResponse(params.message, params.language);
  const fallbackWords = fallback.text.split(' ');
  for (const word of fallbackWords) {
    const chunk = word + ' ';
    fullAccumulatedText += chunk;
    onChunk(chunk);
    await new Promise((res) => setTimeout(res, 20));
  }
  return fullAccumulatedText;
}

/**
 * Non-streaming chat response
 */
export async function generateChatResponse(params: {
  message: string;
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  language?: 'en' | 'hi';
  citizenContext?: { name?: string; state?: string; city?: string };
}): Promise<{ text: string; emergencyCheck: ReturnType<typeof checkEmergencyGuardrails> }> {
  const { model, temperature } = getModelConfig();
  const ai = getGenAI();
  const contents = buildGeminiContents(params);

  const emergencyCheck = checkEmergencyGuardrails(params.message);
  const uniqueModels = getValidModelCascade(model);

  let lastError: any = null;

  for (const currentModel of uniqueModels) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config: {
          systemInstruction: NYAY_SARTHI_SYSTEM_INSTRUCTION,
          temperature,
        }
      });

      const text = response.text || '';
      if (text.trim()) {
        return {
          text,
          emergencyCheck
        };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || JSON.stringify(err);
      const isTransient = err?.status === 503 || err?.code === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429');
      
      console.warn(`Non-streaming attempt on ${currentModel} encountered:`, errMsg);
      if (isTransient) {
        await new Promise((res) => setTimeout(res, 250));
      }
    }
  }

  // Graceful local fallback
  console.warn('Falling back to local statutory intelligence for chat response...');
  const fallback = generateLocalLegalResponse(params.message, params.language);
  return {
    text: fallback.text,
    emergencyCheck
  };
}

export interface AiLegalAnalysisResult {
  text: string;
  understanding: string;
  rights: string[];
  legalArea: string;
  isActionable: string;
  authority: string;
  documents: string[];
  nextSteps: string[];
  legalAid: string;
  recommendedCategory: string;
  suggestedAdvocateSpecialty: string;
  draftTitle: string;
  draftBody: string;
  summary: {
    title: string;
    overview: string;
    keyPoints: string[];
    riskLevel: 'Low' | 'Medium' | 'High' | 'Urgent';
    timelineUrgency: string;
    next48Hours: string[];
    advocateBrief: string;
    estimatedRemedy: string;
  };
  suggestions: string[];
}

/**
 * Structured legal analysis & formal legal notice generator
 */
export async function generateLegalGuidance(params: {
  message: string;
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  language?: 'en' | 'hi';
  citizenContext?: { name?: string; state?: string; city?: string };
}): Promise<AiLegalAnalysisResult> {
  const { message, history = [], language = 'en', citizenContext } = params;
  const { model, temperature } = getModelConfig();
  const ai = getGenAI();

  const conversationContext = history
    .slice(-6)
    .map(h => `${h.sender === 'user' ? 'Citizen' : 'Nyay Sarthi'}: ${sanitizeUserInput(h.text)}`)
    .join('\n');

  const prompt = `Citizen's Legal Inquiry / Scenario:
"${sanitizeUserInput(message)}"

Language preference: ${language === 'hi' ? 'Hindi (हिंदी)' : 'English'}
Citizen Context: ${citizenContext ? `Name: ${citizenContext.name || 'Citizen'}, Location: ${[citizenContext.city, citizenContext.state].filter(Boolean).join(', ') || 'India'}` : 'Indian Citizen'}

Previous Context:
${conversationContext || 'New consultation.'}

Provide a comprehensive, empathetic legal analysis conforming to Indian statutes and output strictly the required JSON schema.`;

  const uniqueModels = getValidModelCascade(model);

  let lastError: any = null;

  for (const currentModel of uniqueModels) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          systemInstruction: NYAY_SARTHI_SYSTEM_INSTRUCTION,
          temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "Empathetic, clear, and concise conversational legal response directly answering the user's specific question."
              },
              understanding: {
                type: Type.STRING,
                description: "1-2 sentence crisp synopsis of the citizen's specific inquiry or grievance."
              },
              rights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 2-4 key Indian statutory sections, Acts, and constitutional rights applicable."
              },
              legalArea: {
                type: Type.STRING,
                description: "Specific legal field (e.g., 'Cyber Crime & Recovery', 'Consumer Protection', 'Tenancy & Property Dispute', 'Criminal Law & FIR', 'Labour & Employment')."
              },
              isActionable: {
                type: Type.STRING,
                description: "Actionability rating and urgency timeline."
              },
              authority: {
                type: Type.STRING,
                description: "The exact forum, commission, tribunal, DLSA, or police station with jurisdiction."
              },
              documents: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Checklist of 3-5 necessary evidentiary documents the citizen must preserve."
              },
              nextSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-5 chronological, actionable steps the citizen should take right now."
              },
              legalAid: {
                type: Type.STRING,
                description: "NALSA / DLSA Section 12 free legal aid eligibility guidance."
              },
              recommendedCategory: {
                type: Type.STRING,
                description: "Matching category from platform: 'Cyber Crime', 'Consumer Dispute', 'Civil Law', 'Criminal Law', 'Labour & Employment', 'Family & Matrimonial', 'Property & Real Estate', 'Banking & Cheque Bounce', 'Constitutional & RTI'."
              },
              suggestedAdvocateSpecialty: {
                type: Type.STRING,
                description: "Advocate title and specialization needed."
              },
              draftTitle: {
                type: Type.STRING,
                description: "Title for formal legal notice, representation, or police petition."
              },
              draftBody: {
                type: Type.STRING,
                description: "Complete formal legal notice or complaint draft with proper legal formatting and placeholders."
              },
              summary: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Short title of the case brief" },
                  overview: { type: Type.STRING, description: "2-3 sentence executive synopsis of the grievance and legal stance" },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "3-4 bullet points highlighting statutory merits and claims"
                  },
                  riskLevel: {
                    type: Type.STRING,
                    enum: ["Low", "Medium", "High", "Urgent"],
                    description: "Urgency assessment"
                  },
                  timelineUrgency: { type: Type.STRING, description: "Statutory limitation period or deadline notice window" },
                  next48Hours: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "2-3 immediate checklist actions for the citizen within 48 hours"
                  },
                  advocateBrief: { type: Type.STRING, description: "A concise 3-line briefing the citizen can present directly to an advocate" },
                  estimatedRemedy: { type: Type.STRING, description: "Likely legal remedies, refunds, damages, or injunctive relief" }
                },
                required: ["title", "overview", "keyPoints", "riskLevel", "timelineUrgency", "next48Hours", "advocateBrief", "estimatedRemedy"]
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-4 dynamic follow-up questions or next actions the citizen can click on."
              }
            },
            required: [
              "text", "understanding", "rights", "legalArea", "isActionable", 
              "authority", "documents", "nextSteps", "legalAid", 
              "recommendedCategory", "suggestedAdvocateSpecialty", 
              "draftTitle", "draftBody", "summary", "suggestions"
            ]
          }
        }
      });

      const raw = response.text || "{}";
      const jsonText = cleanJsonText(raw);
      const parsed = JSON.parse(jsonText) as AiLegalAnalysisResult;

      if (!parsed.summary) {
        parsed.summary = {
          title: parsed.understanding || "Legal Case Assessment",
          overview: parsed.text?.slice(0, 160) || "Statutory assessment under Indian law.",
          keyPoints: parsed.rights || ["Statutory legal rights apply."],
          riskLevel: "Medium",
          timelineUrgency: "Action recommended within 15-30 days",
          next48Hours: parsed.nextSteps?.slice(0, 3) || ["Preserve evidence", "Consult verified advocate"],
          advocateBrief: `Citizen seeking consultation regarding ${parsed.legalArea || 'legal dispute'}.`,
          estimatedRemedy: "Statutory relief and resolution"
        };
      }

      return parsed;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || JSON.stringify(err);
      const isTransient = err?.status === 503 || err?.code === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429');
      
      console.warn(`Structured analysis attempt on ${currentModel} encountered:`, errMsg);
      if (isTransient) {
        await new Promise((res) => setTimeout(res, 250));
      }
    }
  }

  // Offline structured generator
  console.warn('Falling back to local statutory analysis engine...');
  const fallback = generateLocalLegalResponse(message, language);
  return {
    text: fallback.text,
    understanding: fallback.category + ' matter under Indian statutory provisions.',
    rights: fallback.rights,
    legalArea: fallback.category,
    isActionable: 'Actionable within statutory timeframe.',
    authority: fallback.authority,
    documents: [
      'Written correspondence and communication records',
      'Proof of payment / invoices / bank statements',
      'Identity and residence documentation'
    ],
    nextSteps: fallback.nextSteps,
    legalAid: fallback.legalAid,
    recommendedCategory: fallback.category.includes('Cyber') ? 'Cyber Crime' : fallback.category.includes('Consumer') ? 'Consumer Dispute' : fallback.category.includes('Tenancy') ? 'Property & Real Estate' : 'Civil Law',
    suggestedAdvocateSpecialty: fallback.category + ' Specialist Advocate',
    draftTitle: `Legal Notice for ${fallback.category}`,
    draftBody: `LEGAL NOTICE\n\nTo,\n[Recipient Name / Company]\n[Address]\n\nSubject: Formal Demand Notice regarding ${fallback.category}\n\nUnder instructions from my client, I hereby state that your failure to address the stated grievance constitutes a violation of applicable statutory provisions.\n\nYou are called upon to rectify the default within 15 days of receipt of this notice, failing which legal proceedings shall be initiated before the competent court of jurisdiction.\n\nDate: ${new Date().toLocaleDateString()}\nAdvocate / Legal Representative`,
    summary: {
      title: `${fallback.category} Assessment`,
      overview: fallback.text.slice(0, 150),
      keyPoints: fallback.rights,
      riskLevel: 'Medium',
      timelineUrgency: 'Action within 15-30 days recommended',
      next48Hours: fallback.nextSteps.slice(0, 2),
      advocateBrief: `Citizen requires formal counsel for ${fallback.category}.`,
      estimatedRemedy: 'Statutory restitution, compensation, or dispute settlement'
    },
    suggestions: language === 'hi' ? [
      'मुझे कौन से कानूनी दस्तावेज सुरक्षित रखने चाहिए?',
      'क्या मैं यह शिकायत ऑनलाइन दर्ज कर सकता हूँ?',
      'सत्यापित वकील से परामर्श प्राप्त करें'
    ] : [
      'What documents should I preserve as evidence?',
      'Can I file this complaint online?',
      'Connect with a verified advocate'
    ]
  };
}

/**
 * Summarize consultation thread for advocate or citizen review
 */
export async function summarizeLegalDiscussion(params: {
  text?: string;
  messages?: Array<{ sender: string; text: string }>;
  language?: 'en' | 'hi';
}) {
  const { text, messages = [], language = 'en' } = params;
  const { model, temperature } = getModelConfig();
  const ai = getGenAI();

  const conversation = text || messages.map(m => `${m.sender}: ${m.text}`).join('\n');

  const prompt = `Analyze and generate an executive Legal Case Brief for the following consultation:
${conversation}

Language: ${language === 'hi' ? 'Hindi' : 'English'}
Extract: title, overview, 3 key points, risk level (Low/Medium/High/Urgent), timeline urgency, next 48 hours actions, 3-line advocate brief, and estimated remedy. Output strictly JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: NYAY_SARTHI_SYSTEM_INSTRUCTION,
        temperature,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High", "Urgent"] },
            timelineUrgency: { type: Type.STRING },
            next48Hours: { type: Type.ARRAY, items: { type: Type.STRING } },
            advocateBrief: { type: Type.STRING },
            estimatedRemedy: { type: Type.STRING }
          },
          required: ["title", "overview", "keyPoints", "riskLevel", "timelineUrgency", "next48Hours", "advocateBrief", "estimatedRemedy"]
        }
      }
    });

    return JSON.parse(cleanJsonText(response.text || "{}"));
  } catch (err) {
    console.warn('Summarization fallback error:', err);
    return {
      title: "Legal Case Summary & Action Brief",
      overview: "Consultation regarding legal dispute under Indian law.",
      keyPoints: ["Documentary evidence preserved", "Statutory notice to be prepared"],
      riskLevel: "Medium",
      timelineUrgency: "15-30 days standard window",
      next48Hours: ["Collate receipts & communications", "Prepare statutory notice draft", "Consult verified advocate"],
      advocateBrief: "Citizen requires formal advocate consultation for dispute resolution.",
      estimatedRemedy: "Statutory compensation, refund, or injunctive relief"
    };
  }
}

/**
 * Generate contextual follow-up questions
 */
export async function generateFollowUpSuggestions(params: {
  message: string;
  context?: string;
  language?: 'en' | 'hi';
}): Promise<string[]> {
  const { message, context = '', language = 'en' } = params;
  const { model } = getModelConfig();
  const ai = getGenAI();

  const prompt = `Based on this legal inquiry: "${message}" and context: "${context}", provide 4 short, helpful follow-up questions or next actions the Indian citizen might want to ask next. Output JSON array of strings.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: NYAY_SARTHI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const parsed = JSON.parse(cleanJsonText(response.text || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return language === 'hi' ? [
      "मुझे कौन से सबूत तैयार रखने चाहिए?",
      "क्या मैं यह शिकायत ऑनलाइन दर्ज कर सकता हूँ?",
      "यदि सामने वाला नोटिस का जवाब न दे तो क्या करें?",
      "मुझे किसी प्रमाणित वकील से जोड़ें"
    ] : [
      "What evidence do I need to keep ready?",
      "Can I file this complaint online?",
      "What are my rights if they ignore the notice?",
      "Connect me with a verified advocate"
    ];
  }
}
