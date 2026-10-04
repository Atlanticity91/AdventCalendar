import { applyVolumes, playPop, toggleMusic, useMusicOn } from '../lib/audio'
import { setVolume, useSoundPrefs } from '../lib/store'
import './SoundPanel.css'

export function SoundPanel({ day }: { day: number }) {
  const musicOn = useMusicOn()
  const volumes = useSoundPrefs()

  return (
    <div className="sound-panel">
      <button type="button" className="sound-toggle" onClick={() => toggleMusic(day)}>
        {musicOn ? 'Pause music' : 'Play music'}
      </button>

      <label className="sound-row">
        Music
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volumes.music}
          onChange={(e) => {
            setVolume('music', Number(e.target.value))
            applyVolumes()
          }}
          // The demo plays a test blip when the slider is released, not while dragging.
          onPointerUp={playPop}
          onKeyUp={playPop}
        />
      </label>

      <label className="sound-row">
        Effects
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volumes.effects}
          onChange={(e) => {
            setVolume('effects', Number(e.target.value))
            applyVolumes()
          }}
          onPointerUp={playPop}
          onKeyUp={playPop}
        />
      </label>
    </div>
  )
}
