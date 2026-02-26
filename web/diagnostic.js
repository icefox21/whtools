// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

// Diagnostic script to check frontend state issues
// This should be run in the browser console when the issue occurs

function diagnoseTextGateIssues() {
    console.log("=== Text Gate Diagnostic ===");

    // Find all WuhuoTextGate nodes
    const graph = window.app && window.app.graph;
    if (!graph) {
        console.error("❌ No graph found");
        return;
    }

    const nodes = (graph._nodes || graph.nodes) || [];
    const textGates = nodes.filter(n => {
        const type = String(n.type || "");
        return type.includes("WuhuoTextGate");
    });

    console.log(`Found ${textGates.length} WuhuoTextGate nodes`);

    textGates.forEach((gate, index) => {
        console.log(`\n--- Node ${index + 1} (ID: ${gate.id}) ---`);

        // Check basic properties
        console.log(`Position: [${gate.pos[0]}, ${gate.pos[1]}]`);
        console.log(`Size: [${gate.size ? gate.size[0] : 'unknown'}, ${gate.size ? gate.size[1] : 'unknown'}]`);

        // Check LiteGraph execution mode
        const LG = window.LiteGraph || {};
        console.log(`Mode: ${gate.mode} (ALWAYS=${LG.ALWAYS}, NEVER=${LG.NEVER})`);
        if (gate.mode === LG.NEVER) {
            console.warn("⚠️  Node is in NEVER mode - this might be the 'mute' issue!");
        } else if (gate.mode === LG.ALWAYS) {
            console.log("✅ Node is in ALWAYS mode - should execute normally");
        } else {
            console.log(`ℹ️  Node mode: ${gate.mode}`);
        }

        // Check widgets
        const widgets = gate.widgets || [];
        console.log(`Widgets: ${widgets.length}`);

        const enableEdit = widgets.find(w => w.name === "enable_edit");
        const freePass = widgets.find(w => w.name === "free_pass");
        const editText = widgets.find(w => w.name === "edit_text");
        const inText = widgets.find(w => w.name === "in_text");

        console.log(`enable_edit: ${enableEdit ? enableEdit.value : 'not found'}`);
        console.log(`free_pass: ${freePass ? freePass.value : 'not found'}`);
        console.log(`edit_text: ${editText ? editText.value : 'not found'}`);
        console.log(`in_text: ${inText ? inText.value : 'not found'}`);

        // Check input connections
        const inputs = gate.inputs || [];
        const inTextInput = inputs.find(i => ["in_text", "输入文本"].includes(i.name || ""));
        if (inTextInput) {
            console.log(`in_text connection: ${inTextInput.link ? 'connected' : 'not connected'}`);
            if (inTextInput.link) {
                const link = graph.links && graph.links[inTextInput.link];
                if (link) {
                    console.log(`Connected to node ${link.origin_id}`);
                }
            }
        }

        // Check properties
        const props = gate.properties || {};
        console.log(`Properties:`, props);

        // Check colors (visual state)
        console.log(`Background color: ${gate.bgcolor}`);
        console.log(`Text color: ${gate.color}`);

        // Check if node is selected
        const canvas = window.app && window.app.canvas;
        if (canvas && canvas.selected_nodes) {
            const isSelected = Object.values(canvas.selected_nodes).some(n => n.id === gate.id);
            console.log(`Selected: ${isSelected}`);
        }
    });

    // Check queue status
    if (window.app && window.app.api) {
        window.app.api.fetchApi('/queue')
            .then(response => response.json())
            .then(queueData => {
                console.log("\n--- Queue Status ---");
                console.log("Queue running:", queueData.queue_running);
                console.log("Queue pending:", queueData.queue_pending);
            })
            .catch(err => console.error("Failed to check queue:", err));
    }

    console.log("\n=== Diagnostic Complete ===");
}

// Run the diagnostic
setTimeout(diagnoseTextGateIssues, 1000);

console.log("Diagnostic script loaded. Check the console output above.");