import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

const NODE_TYPE = "WuhuoImageComparer";

let compareQueueNodeIds = null;
let compareQueueHooked = false;

function imageDataToUrl(data) {
    const subfolder = data.subfolder || "";
    return api.apiURL(`/view?filename=${encodeURIComponent(data.filename)}&type=${data.type}&subfolder=${subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`);
}

function recursiveAddNodes(nodeId, oldOutput, newOutput) {
    const currentId = String(nodeId);
    const currentNode = oldOutput[currentId];
    if (currentNode && newOutput[currentId] == null) {
        newOutput[currentId] = currentNode;
        for (const inputValue of Object.values(currentNode.inputs || {})) {
            if (Array.isArray(inputValue)) {
                recursiveAddNodes(inputValue[0], oldOutput, newOutput);
            }
        }
    }
    return newOutput;
}

function initCompareQueueHook() {
    if (compareQueueHooked) return;
    compareQueueHooked = true;

    const originalApiQueuePrompt = api.queuePrompt.bind(api);
    api.queuePrompt = async function (index, prompt) {
        if (compareQueueNodeIds?.length && prompt?.output) {
            const oldOutput = prompt.output;
            const newOutput = {};
            for (const nodeId of compareQueueNodeIds) {
                recursiveAddNodes(nodeId, oldOutput, newOutput);
            }
            if (Object.keys(newOutput).length > 0) {
                prompt.output = newOutput;
            } else {
                throw new Error("[whtools] 未能收集到图像对比+节点依赖，已取消快捷执行。");
            }
        }
        return originalApiQueuePrompt(index, prompt);
    };
}

async function queueCompareNode(nodeId) {
    try {
        compareQueueNodeIds = [nodeId];
        await app.queuePrompt(0);
        return true;
    } catch (err) {
        console.error("[whtools] 图像对比+快捷执行失败:", err);
        return false;
    } finally {
        compareQueueNodeIds = null;
    }
}

function makeItem(data, name, selected) {
    return {
        name,
        file: data.filename,
        type: data.type,
        subfolder: data.subfolder || "",
        url: imageDataToUrl(data),
        selected,
        img: null,
    };
}

function ensureImage(item, node) {
    if (!item || item.img) return;
    item.img = new Image();
    item.img.onload = () => node.setDirtyCanvas(true, false);
    item.img.onerror = () => node.setDirtyCanvas(true, false);
    item.img.src = item.url;
}

function setSelected(node, selected) {
    const images = node._wuhuoCompareImages || [];
    for (const image of images) image.selected = false;
    node._wuhuoCompareSelected = selected.filter(Boolean).slice(0, 2);
    for (const item of node._wuhuoCompareSelected) {
        item.selected = true;
        ensureImage(item, node);
    }
    node.setDirtyCanvas(true, true);
}

function drawContainedImage(ctx, item, node, y, cropX = null) {
    const img = item?.img;
    if (!img?.naturalWidth || !img?.naturalHeight) return;

    const nodeWidth = node.size[0];
    const nodeHeight = node.size[1];
    const areaHeight = Math.max(1, nodeHeight - y - 6);
    const imageAspect = img.naturalWidth / img.naturalHeight;
    const areaAspect = nodeWidth / areaHeight;

    let drawW;
    let drawH;
    if (imageAspect > areaAspect) {
        drawW = nodeWidth;
        drawH = nodeWidth / imageAspect;
    } else {
        drawH = areaHeight;
        drawW = areaHeight * imageAspect;
    }

    const dx = (nodeWidth - drawW) / 2;
    const dy = y + (areaHeight - drawH) / 2;
    const visibleW = cropX == null ? drawW : Math.max(0, Math.min(cropX - dx, drawW));
    const srcW = cropX == null ? img.naturalWidth : Math.max(0, (visibleW / drawW) * img.naturalWidth);

    ctx.save();
    if (cropX != null) {
        ctx.beginPath();
        ctx.rect(dx, dy, visibleW, drawH);
        ctx.clip();
    }
    ctx.drawImage(img, 0, 0, srcW || img.naturalWidth, img.naturalHeight, dx, dy, visibleW || drawW, drawH);
    if (cropX != null && cropX >= dx && cropX <= dx + drawW) {
        const oldComposite = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = "difference";
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.moveTo(cropX, dy);
        ctx.lineTo(cropX, dy + drawH);
        ctx.stroke();
        ctx.globalCompositeOperation = oldComposite;
    }
    ctx.restore();
}

function copyImageToClipboard(url) {
    return fetch(url)
        .then((response) => response.blob())
        .then((blob) => navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]));
}

function downloadImage(url, filename) {
    return fetch(url)
        .then((response) => response.blob())
        .then((blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename || "image.png";
            link.click();
            URL.revokeObjectURL(link.href);
        });
}

function showCollectMenu(posX, posY, item, node) {
    fetch("/jdsc/assets/list")
        .then((res) => res.json())
        .then((data) => {
            if (!data.success) {
                alert("获取分类失败: " + (data.error || "未知错误"));
                return;
            }
            const subOptions = (data.categories || [])
                .filter((cat) => cat.name !== "全部" && cat.name !== "预览+历史记录")
                .map((cat) => ({
                    content: `📁 ${cat.name}`,
                    callback: () => {
                        fetch("/jdsc/assets/save_media", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url: item.url, target_category: cat.name }),
                        })
                            .then((res) => res.json())
                            .then((saveData) => {
                                if (!saveData.success) {
                                    alert("收藏失败: " + (saveData.error || "未知错误"));
                                }
                            })
                            .catch((err) => {
                                console.error("[whtools] 收藏图片失败:", err);
                                alert("收藏失败");
                            });
                    },
                }));

            if (!subOptions.length) {
                alert("素材库中还没有自定义目录，请先打开素材库进行添加！");
                return;
            }

            LiteGraph.closeAllContextMenus();
            new LiteGraph.ContextMenu(subOptions, { event: null, left: posX, top: posY, node });
        })
        .catch((err) => {
            console.error("[whtools] 获取素材库分类失败:", err);
            alert("获取分类列表失败");
        });
}

function addPreviewLikeImageMenu(options, item) {
    options.push({
        content: "⭐ 收藏到素材库",
        callback: (value, menuOptions, e, menu, node) => {
            const posX = e?.clientX ?? menu?.root?.getBoundingClientRect().left ?? 100;
            const posY = e?.clientY ?? menu?.root?.getBoundingClientRect().top ?? 100;
            showCollectMenu(posX, posY, item, node);
        },
    });
    options.push({
        content: "打开图像",
        callback: () => window.open(item.url, "_blank"),
    });
    options.push({
        content: "保存图像",
        callback: async () => {
            try {
                await downloadImage(item.url, item.file);
            } catch (err) {
                console.error("[whtools] 保存图像失败:", err);
            }
        },
    });
    options.push({
        content: "复制图像",
        callback: async () => {
            try {
                await copyImageToClipboard(item.url);
            } catch (err) {
                console.error("[whtools] 复制图像失败:", err);
                alert("复制失败，请使用浏览器的右键菜单复制");
            }
        },
    });
}

function chooseRightClickedItem(node, canvas) {
    const selected = node._wuhuoCompareSelected || [];
    if (!selected.length) return null;
    const mouse = canvas?.graph_mouse;
    const localX = mouse ? mouse[0] - node.pos[0] : node._wuhuoPointerX;
    return selected[localX > node.size[0] / 2 && selected[1] ? 1 : 0] || selected[0];
}

app.registerExtension({
    name: "whtools.image_compare",

    async setup() {
        initCompareQueueHook();
        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
                return;
            }
            if (e.key.toLowerCase() !== "z") return;

            const mouse = app.canvas?.graph_mouse;
            const graph = app.graph;
            if (!mouse || !graph?._nodes) return;

            for (const node of graph._nodes) {
                if (node.type !== NODE_TYPE) continue;
                const isMouseOver = mouse[0] >= node.pos[0] &&
                    mouse[0] <= node.pos[0] + node.size[0] &&
                    mouse[1] >= node.pos[1] &&
                    mouse[1] <= node.pos[1] + node.size[1];

                if (isMouseOver) {
                    node.triggerQueueThisNode?.();
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                }
            }
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        nodeType["@comparer_mode"] = { type: "combo", values: ["Slide", "Click"] };

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.apply(this, arguments);
            this.properties = this.properties || {};
            this.properties.comparer_mode = this.properties.comparer_mode || "Slide";
            this._wuhuoCompareImages = [];
            this._wuhuoCompareSelected = [];
            this._wuhuoPointerX = this.size?.[0] ? this.size[0] / 2 : 160;
            this._wuhuoPointerOver = false;
            this._wuhuoPointerDown = false;
            this.setSize([Math.max(this.size?.[0] || 320, 320), Math.max(this.size?.[1] || 260, 260)]);
        };

        nodeType.prototype.onExecuted = function (output) {
            output = output || {};
            const aImages = output.a_images || [];
            const bImages = output.b_images || [];
            const images = [];
            const multiple = aImages.length + bImages.length > 2;

            for (const [i, data] of aImages.entries()) {
                images.push(makeItem(data, aImages.length > 1 || multiple ? `A${i + 1}` : "A", i === 0));
            }
            for (const [i, data] of bImages.entries()) {
                images.push(makeItem(data, bImages.length > 1 || multiple ? `B${i + 1}` : "B", i === 0));
            }
            if (!bImages.length && images.length > 1) images[1].selected = true;

            this._wuhuoCompareImages = images;
            setSelected(this, images.filter((image) => image.selected));
        };

        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origOnDrawForeground?.apply(this, arguments);
            const images = this._wuhuoCompareImages || [];
            const selected = this._wuhuoCompareSelected || [];
            const labelY = 6;
            let imageY = 24;

            ctx.save();
            ctx.font = "14px Arial";
            ctx.textBaseline = "top";

            if (images.length > 2) {
                const gap = 8;
                const labels = images.map((image) => ({ image, width: ctx.measureText(image.name).width }));
                const totalWidth = labels.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, labels.length - 1);
                let x = Math.max(4, (this.size[0] - totalWidth) / 2);
                this._wuhuoCompareHitAreas = [];
                for (const label of labels) {
                    ctx.fillStyle = label.image.selected ? "rgba(235,235,235,1)" : "rgba(235,235,235,0.48)";
                    ctx.fillText(label.image.name, x, labelY);
                    this._wuhuoCompareHitAreas.push({ x, y: labelY, w: label.width, h: 16, image: label.image });
                    x += label.width + gap;
                }
                imageY = 30;
            } else {
                this._wuhuoCompareHitAreas = [];
            }

            if (!selected.length) {
                ctx.fillStyle = "rgba(180,180,180,0.75)";
                ctx.textAlign = "center";
                ctx.fillText("连接 image_a / image_b 后运行以开始对比", this.size[0] / 2, 54);
                ctx.restore();
                return;
            }

            ctx.restore();

            if ((this.properties?.comparer_mode || "Slide") === "Click") {
                drawContainedImage(ctx, selected[this._wuhuoPointerDown ? 1 : 0] || selected[0], this, imageY);
            } else {
                drawContainedImage(ctx, selected[0], this, imageY);
                if (selected[1] && this._wuhuoPointerOver) {
                    drawContainedImage(ctx, selected[1], this, imageY, this._wuhuoPointerX);
                }
            }
        };

        const origOnMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (event, pos, canvas) {
            for (const area of this._wuhuoCompareHitAreas || []) {
                if (pos[0] >= area.x && pos[0] <= area.x + area.w && pos[1] >= area.y && pos[1] <= area.y + area.h) {
                    const selected = [...(this._wuhuoCompareSelected || [])];
                    if (area.image.name.startsWith("A")) selected[0] = area.image;
                    else if (area.image.name.startsWith("B")) selected[1] = area.image;
                    setSelected(this, selected);
                    return true;
                }
            }
            origOnMouseDown?.apply(this, arguments);
            this._wuhuoPointerDown = true;
            this.setDirtyCanvas(true, false);
            return false;
        };

        const origOnMouseUp = nodeType.prototype.onMouseUp;
        nodeType.prototype.onMouseUp = function (event, pos, canvas) {
            origOnMouseUp?.apply(this, arguments);
            this._wuhuoPointerDown = false;
            this.setDirtyCanvas(true, false);
        };

        const origOnMouseEnter = nodeType.prototype.onMouseEnter;
        nodeType.prototype.onMouseEnter = function (event) {
            origOnMouseEnter?.apply(this, arguments);
            this._wuhuoPointerOver = true;
            this.setDirtyCanvas(true, false);
        };

        const origOnMouseLeave = nodeType.prototype.onMouseLeave;
        nodeType.prototype.onMouseLeave = function (event) {
            origOnMouseLeave?.apply(this, arguments);
            this._wuhuoPointerOver = false;
            this._wuhuoPointerDown = false;
            this.setDirtyCanvas(true, false);
        };

        const origOnMouseMove = nodeType.prototype.onMouseMove;
        nodeType.prototype.onMouseMove = function (event, pos, canvas) {
            origOnMouseMove?.apply(this, arguments);
            this._wuhuoPointerX = pos[0];
            this.setDirtyCanvas(true, false);
        };

        nodeType.prototype.triggerQueueThisNode = async function () {
            const success = await queueCompareNode(this.id);
            if (success) this.setDirtyCanvas(true, true);
        };

        const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            options = options || [];
            const result = origGetExtraMenuOptions?.apply(this, arguments);
            const item = chooseRightClickedItem(this, canvas);
            if (item) addPreviewLikeImageMenu(options, item);
            return result;
        };
    },
});
