import "./AiProfessorAvatar.css";

export type ProfessorState = "idle" | "listening" | "thinking" | "speaking";

interface AiProfessorAvatarProps {
  state: ProfessorState;
  className?: string;
}

export default function AiProfessorAvatar({ state, className = "" }: AiProfessorAvatarProps) {
  return (
    <div className={`ai-professor-avatar state-${state} ${className}`}>
      {/* Outer Hologram / Glowing Aura */}
      <div className="avatar-aura"></div>
      
      {/* Animated Orbital Rings */}
      <div className="avatar-ring ring-1"></div>
      <div className="avatar-ring ring-2"></div>
      <div className="avatar-ring ring-3"></div>

      {/* Core Glowing Sphere */}
      <div className="avatar-core">
        <div className="core-gradient"></div>
        <div className="core-face">
          {/* Cyber Visor / Eyes */}
          <div className="visor-eye eye-left">
            <span className="eye-pupil"></span>
          </div>
          <div className="visor-eye eye-right">
            <span className="eye-pupil"></span>
          </div>

          {/* Equalizer Wavebars when speaking */}
          {state === "speaking" && (
            <div className="voice-equalizer">
              <span className="bar bar-1"></span>
              <span className="bar bar-2"></span>
              <span className="bar bar-3"></span>
              <span className="bar bar-4"></span>
              <span className="bar bar-5"></span>
            </div>
          )}

          {/* Thinking spinner dots */}
          {state === "thinking" && (
            <div className="thinking-loader">
              <span className="dot dot-1"></span>
              <span className="dot dot-2"></span>
              <span className="dot dot-3"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
