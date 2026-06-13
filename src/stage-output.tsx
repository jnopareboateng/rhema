/* eslint-disable react-refresh/only-export-components */
import { createRoot } from "react-dom/client"

function StageOutput() {
  return <div data-slot="stage-output" style={{ width: "100vw", height: "100vh", background: "#000" }} />
}

const root = document.getElementById("stage-root")!
createRoot(root).render(<StageOutput />)
