import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperPipeline {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            await WhisperPipeline.getInstance(x => {
                self.postMessage({ type: 'progress', data: x });
            });
            self.postMessage({ type: 'loaded' });
        } catch (e) {
            self.postMessage({ type: 'error', error: e.message });
        }
    } else if (type === 'transcribe') {
        try {
            const transcriber = await WhisperPipeline.getInstance();
            // audio should be Float32Array
            const out = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: 'russian',
                task: 'transcribe',
            });
            self.postMessage({ type: 'result', text: out.text });
        } catch (e) {
            self.postMessage({ type: 'error', error: e.message });
        }
    }
});
