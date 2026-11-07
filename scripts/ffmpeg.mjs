// FFmpeg portátil del proyecto (devDependencies ffmpeg-static y ffprobe-static): no hace falta instalar nada en el sistema.
// HyperFrames lo lee de HYPERFRAMES_FFMPEG_PATH / HYPERFRAMES_FFPROBE_PATH; si ya están definidas, se respetan.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
try { process.env.HYPERFRAMES_FFMPEG_PATH ||= require('ffmpeg-static'); } catch { /* sin ffmpeg-static: se usa el del PATH */ }
try { process.env.HYPERFRAMES_FFPROBE_PATH ||= require('ffprobe-static').path; } catch { /* idem */ }
export const FFMPEG = process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.HYPERFRAMES_FFPROBE_PATH || 'ffprobe';
