import { sendAiTurn, type AiMode, type ConsultantSub, type AiTurnResult } from "./ai_workspace.ts";

export class HybridAIProvider {
  private engine: any = null;
  private isInitializing = false;
  private initPromise: Promise<boolean> | null = null;
  private webGpuSupported = false;
  private modelId = "Llama-3-8B-Instruct-q4f32_1-MLC";

  async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    if (typeof navigator === 'undefined' || !("gpu" in navigator)) {
      this.webGpuSupported = false;
      return false;
    }
    
    this.initPromise = (async () => {
      try {
        this.isInitializing = true;
        const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
        const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
        this.engine = await CreateWebWorkerMLCEngine(
          worker,
          this.modelId,
          {
            initProgressCallback: (progress) => {
              console.log("WebLLM Progress:", progress);
            }
          }
        );
        this.webGpuSupported = true;
        return true;
      } catch (e) {
        console.warn("Failed to initialize WebLLM, falling back to backend API", e);
        this.webGpuSupported = false;
        return false;
      } finally {
        this.isInitializing = false;
      }
    })();
    return this.initPromise;
  }

  async sendAiTurnHybrid(args: {
    mode: AiMode;
    message: string;
    context: string;
    expertProtocol?: string;
    architectDocType?: string;
    lang?: string;
    consultantSub?: ConsultantSub;
    educatorLite?: boolean;
    appId?: string;
    installId?: string;
    terminalUserId?: string;
  }): Promise<AiTurnResult> {
    // WebLLM logic for Academy chat
    const canUseLocal = (args.mode === "consultant" && args.consultantSub === "academy");
    
    if (canUseLocal && this.webGpuSupported && this.engine) {
      try {
        let systemPrompt = "Ты доброжелательный и умный ИИ-Профессор академии. Отвечай коротко, по существу, основываясь на переданном контексте. По умолчанию отвечай на русском языке.";
        if (args.lang === "en") {
          systemPrompt = "You are a friendly and smart AI Academy Professor. Answer briefly and to the point, based on the provided context. Default language is English.";
        }

        // Try to respect the requested system prompt logic
        if (args.message.includes("style: accessible, scientific, with a real-life example")) {
            systemPrompt += " Reply in Robert Sapolsky's style: accessible, scientific, with a real-life example.";
        } else if (args.message.includes("Ответь в стиле Сапольского")) {
            systemPrompt += " Ответь в стиле Сапольского: понятно, научно, с живым примером.";
        }

        const fullPrompt = args.context ? `Контекст / Context:\n${args.context}\n\nЗапрос / Query:\n${args.message}` : args.message;
        
        const response = await this.engine.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullPrompt }
          ],
        });
        
        const reply = response.choices[0].message.content || "";
        return {
          reply,
          session_id: "local-session",
          structured: false
        };
      } catch (e) {
        console.warn("WebLLM inference failed, falling back to backend", e);
      }
    }
    
    // Fallback to backend API
    return sendAiTurn(args);
  }
}

export const hybridAI = new HybridAIProvider();
