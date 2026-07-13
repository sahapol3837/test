/**
 * 1. ระบบจำลองการจัดการพิกัด (Tree Node Data)
 */
function createNodeData() {
    return { l: 0, r: 0, w: 0, t: 0, b: 0, h: 0, e: {}, n: [], yl: {}, yr: {} };
}

function addNodeToData(d, id, person, x, y) {
    d.e[id] = { person: person, x: x, y: y };
    d.l = Math.min(d.l, x);
    d.r = Math.max(d.r, 1 + x);
    d.w = d.r - d.l;
    d.t = Math.min(d.t, y);
    d.b = Math.max(d.b, 1 + y);
}

function addLineToData(d, x1, y1, x2, y2, type) {
    d.n.push({ x1: x1, y1: y1, x2: x2, y2: y2, type: type });
}

/**
 * 2. ระบบคำนวณพิกัดกล่องเครือญาติ (Layout Engine)
 * จำลองจากฟังก์ชัน BGD / BFT เพื่อหาตำแหน่ง X, Y ของคนในผัง
 */
function calculateFamilyLayout(familyData, focusId) {
    let d = createNodeData();
    let visited = {};

    function traverse(id, currentX, currentY) {
        if (!id || visited[id] || !familyData[id]) return;
        visited[id] = true;

        let person = familyData[id];
        addNodeToData(d, id, person, currentX, currentY);

        // 1. ลากเส้นและจัดตำแหน่งคู่สมรส (แกน X ด้านขวา)
        if (person.s && familyData[person.s]) {
            let spouseId = person.s;
            if (!visited[spouseId]) {
                traverse(spouseId, currentX + 1.5, currentY);
                addLineToData(d, currentX, currentY, currentX + 1.5, currentY, "partner");
            }
        }

        // 2. ลากเส้นและจัดตำแหน่งลูกๆ (แกน Y ด้านล่าง)
        if (person.c && person.c.length > 0) {
            let totalChildren = person.c.length;
            let startX = currentX - ((totalChildren - 1) * 1.2) / 2;

            // ลากเส้นแนวดิ่งหลักลงมาจากพ่อแม่
            addLineToData(d, currentX, currentY, currentX, currentY + 0.5, "vertical");
            // ลากเส้นแนวนอนแยกสายแจกจ่ายให้ลูกแต่ละคน
            if (totalChildren > 1) {
                addLineToData(d, startX, currentY + 0.5, startX + (totalChildren - 1) * 1.2, currentY + 0.5, "horizontal");
            }

            person.c.forEach((childId, index) => {
                let childX = startX + index * 1.2;
                let childY = currentY + 1.2;
                
                // เส้นแนวดิ่งย่อยลากเข้าหัวกล่องของลูก
                addLineToData(d, childX, currentY + 0.5, childX, childY, "vertical");
                traverse(childId, childX, childY);
            });
        }
    }

    traverse(focusId, 0, 0);
    return d;
}

/**
 * 3. ระบบวาดผังขึ้นหน้าจอจริง (DOM Rendering Engine)
 * จำลองจาก TRD / TRL / TRB ใช้ CSS ในการคำนวณความยาวและหมุนองศาเส้นเฉียง
 */
function renderFamilyTree(layoutData, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ""; // เคลียร์หน้าจอก่อนวาดใหม่

    // กำหนดมาตราส่วนพิกัดจำลองให้เป็นพิกเซล (1 หน่วยพิกัด = 150 พิกเซล)
    const scaleX = 160;
    const scaleY = 140;
    
    // คำนวณจุดศูนย์กลางผังให้อยู่กลางจอพอดี
    const offsetX = container.offsetWidth / 2;
    const offsetY = 80;

    // วาดเส้นเชื่อมโยงทั้งหมด (Lines)
    layoutData.n.forEach(line => {
        let x1 = offsetX + line.x1 * scaleX;
        let y1 = offsetY + line.y1 * scaleY;
        let x2 = offsetX + line.x2 * scaleX;
        let y2 = offsetY + line.y2 * scaleY;

        // ถอดสูตรตรีโกณมิติจากฟังก์ชัน TRL เพื่อวาดเส้นเฉียงได้อย่างแม่นยำ
        let dx = x2 - x1;
        let dy = y2 - y1;
        let distance = Math.sqrt(dx * dx + dy * dy); // สูตรหาความยาวเส้น (Pythagoras)
        let angle = Math.atan2(dy, dx);             // สูตรหาองศาการหมุนเส้น

        let lineDiv = document.createElement("div");
        lineDiv.className = `tree-line ${line.type}`;
        lineDiv.style.width = distance + "px";
        lineDiv.style.left = x1 + "px";
        lineDiv.style.top = y1 + "px";
        lineDiv.style.transform = `rotate(${angle}rad)`; // หมุนเส้นตามหน่วย เรเดียน
        
        container.appendChild(lineDiv);
    });

    // วาดกล่องบุคคลทั้งหมด (Boxes)
    for (let id in layoutData.e) {
        let node = layoutData.e[id];
        let px = offsetX + node.x * scaleX;
        let py = offsetY + node.y * scaleY;

        let box = document.createElement("div");
        box.className = `tree-box ${node.person.g}`; // แบ่งสีตามเพศ (m = ชาย, f = หญิง)
        box.style.left = (px - 60) + "px"; // ลบครึ่งหนึ่งของความกว้างกล่องเพื่อให้อยู่ตรงกลางพิกัดพอดี
        box.style.top = (py - 25) + "px";  // ลบครึ่งหนึ่งของความสูงกล่อง
        
        box.innerHTML = `<strong>${node.person.name}</strong>`;
        container.appendChild(box);
    }
}
