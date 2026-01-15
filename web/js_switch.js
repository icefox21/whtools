import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "wuhuo.switch_any",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "WuhuoSwitchAny" || nodeData.name === "WuhuoSelectorAny") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                // 保存原始标题
                this._baseTitle = this.title;

                const optionsWidget = this.widgets?.find(w => w.name === "options");
                if (optionsWidget) {
                    const originalCallback = optionsWidget.callback;
                    const node = this;
                    optionsWidget.callback = function (v) {
                        if (originalCallback) originalCallback.call(this, v);
                        node.updateInputLabels(v);
                        node.updateActiveState();
                    };

                    setTimeout(() => {
                        this.updateInputLabels(optionsWidget.value);
                        this.updateActiveState();
                    }, 100);
                }

                // 监听 boolean/select widget 变化
                const controlWidget = this.widgets?.find(w => w.name === "boolean" || w.name === "select");
                if (controlWidget) {
                    const originalCallback = controlWidget.callback;
                    const node = this;
                    controlWidget.callback = function (v) {
                        if (originalCallback) originalCallback.call(this, v);
                        node.updateActiveState();
                    };
                }

                return r;
            };

            // 处理从工作流加载
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;

                this._baseTitle = this.title;

                setTimeout(() => {
                    const optionsWidget = this.widgets?.find(w => w.name === "options");
                    if (optionsWidget) {
                        this.updateInputLabels(optionsWidget.value);
                    }
                    this.updateActiveState();
                }, 100);

                return r;
            };

            // 更新输入端口的显示名称
            nodeType.prototype.updateInputLabels = function (text) {
                if (!text || typeof text !== 'string') return;
                if (!this.inputs || this.inputs.length === 0) return;

                const lines = text.split("\n").map(l => l.trim()).filter(l => l);

                for (let i = 0; i < this.inputs.length; i++) {
                    if (i < lines.length) {
                        this.inputs[i].label = lines[i];
                    }
                }

                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
            };

            // 获取当前激活的索引
            nodeType.prototype.getActiveIndex = function () {
                if (nodeData.name === "WuhuoSwitchAny") {
                    const boolWidget = this.widgets?.find(w => w.name === "boolean");
                    if (boolWidget) {
                        return boolWidget.value ? 0 : 1;  // true = 第一个, false = 第二个
                    }
                } else if (nodeData.name === "WuhuoSelectorAny") {
                    const selectWidget = this.widgets?.find(w => w.name === "select");
                    if (selectWidget) {
                        return selectWidget.value - 1;  // 1-based to 0-based
                    }
                }
                return 0;
            };

            // 更新激活状态（标题和输入高亮）
            nodeType.prototype.updateActiveState = function () {
                const activeIdx = this.getActiveIndex();

                // 方案4：更新标题显示当前选择
                const optionsWidget = this.widgets?.find(w => w.name === "options");
                if (optionsWidget) {
                    const lines = optionsWidget.value.split("\n").map(l => l.trim()).filter(l => l);
                    if (lines.length > activeIdx && activeIdx >= 0) {
                        const activeName = lines[activeIdx];
                        this.title = `→ ${activeName}`;
                    }
                }

                // 方案1：设置每个输入端口的颜色
                if (this.inputs) {
                    for (let i = 0; i < this.inputs.length; i++) {
                        if (i === activeIdx) {
                            // 激活：亮绿色
                            this.inputs[i].color_on = "#00ff00";
                        } else {
                            // 未激活：灰色
                            this.inputs[i].color_on = "#666666";
                        }
                    }
                }

                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
            };
        }
    }
});
