import { GameCanvas } from './components/game/GameCanvas'
import { HUD } from './components/ui/HUD'
import { TelemetryHUD } from './components/ui/TelemetryHUD'
import { DialogPanel } from './components/ui/DialogPanel'
import { TacticalMenu } from './components/ui/TacticalMenu'
import { useTimeCycle } from './hooks/useTimeCycle'
import { GameAudio } from './components/audio/GameAudio'
import { useEffect } from 'react'
import { validationAgent } from './tests/AIValidationAgent'

function App() {
  useTimeCycle();

  useEffect(() => {
    // Starte automatische Validierung beim Mount (optional verzögert für Ladezeiten)
    setTimeout(() => {
      validationAgent.runFullAudit();
    }, 5000);
  }, []);
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <GameCanvas />
      <HUD />
      <TelemetryHUD />
      <DialogPanel />
      <TacticalMenu />
      <GameAudio />
    </div>
  )
}

export default App
