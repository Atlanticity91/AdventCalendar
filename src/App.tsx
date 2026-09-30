import { Scene } from './scene/Scene'
import { useUser } from './hooks/QueryURLParam'

function App() {
  const user = useUser()

  return (
    <>
      <Scene />
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 14,
          zIndex: 5,
          color: '#eef4ff',
          font: '600 14px system-ui, sans-serif',
          pointerEvents: 'none',
        }}
      >
        User: {user}
      </div>
    </>
  )
}

export default App
