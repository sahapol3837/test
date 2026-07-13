/**
 * 1. ฟังก์ชันช่วยแปลงข้อความจาก CSV ให้เป็นโครงสร้างข้อมูลผังเครือญาติ (CSV Parser)
 */
function parseCSVToFamilyData(csvText) {
    const lines = csvText.trim().split("\n");
    const familyData = {};

    // ลูปอ่านทีละบรรทัด (ข้ามบรรทัดแรกที่เป็น Header)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        
        // แยกข้อมูลด้วย Tab (\t) หรือ Comma (,) ตามรูปแบบของข้อมูลที่ส่งมา
        const cols = lines[i].split(/\t|,/);
        
        const id = cols[0].trim();
        const name = cols[1].trim();
        const father = cols[2] ? cols[2].trim() : "";
        const mother = cols[3] ? cols[3].trim() : "";
        const spouseRaw = cols[4] ? cols[4].trim() : "";
        const gender = cols[5] ? cols[5].trim() : "";

        // จัดการเรื่องคู่สมรสในกรณีที่มีมากกว่า 1 คน (แยกด้วยเครื่องหมาย |)
        const spouses = spouseRaw ? spouseRaw.split("|") : [];

        familyData[id] = {
            id: id,
            name: name,
            father: father,
            mother: mother,
            spouses: spouses, // บันทึกเป็นอาเรย์ของคู่สมรส
            g: (gender === "ช") ? "m" : "f",
            c: [] // จะเติมรายชื่อลูกๆ เข้ามาในขั้นตอนถัดไป
        };
    }

    // ลูปซ้ำรอบที่สองเพื่อผูกสัมพันธ์ สร้างรายชื่อ "ลูก (c)" ให้กับพ่อและแม่โดยอัตโนมัติ
    for (let id in familyData) {
        const person = familyData[id];
        if (person.father && familyData[person.father]) {
            if (!familyData[person.father].c.includes(id)) {
                familyData[person.father].c.push(id);
            }
        }
        if (person.mother && familyData[person.mother]) {
            if (!familyData[person.mother].c.includes(id)) {
                familyData[person.mother].c.push(id);
            }
        }
    }

    return familyData;
}

/**
 * 2. ระบบคำนวณตำแหน่ง (Layout Engine แบบรองรับคู่สมรสหลายคน)
 */
function calculateFamilyLayout(familyData, focusId) {
    let d = { l: 0, r: 0, w: 0, t: 0, b: 0, h: 0, e: {}, n: [] };
    let visited = {};

    function traverse(id, currentX, currentY) {
        if (!id || visited[id] || !familyData[id]) return;
        visited[id] = true;

        let person = familyData[id];
        
        // วาดกล่องบุคคล
        d.e[id] = { person: person, x: currentX, y: currentY };

        // 1. จัดตำแหน่งและลากเส้นแต่งงาน (รองรับการมีคู่สมรสหลายคน)
        let nextSpouseX = currentX;
        if (person.spouses && person.spouses.length > 0) {
            person.spouses.forEach((spouseId, index) => {
                if (familyData[spouseId] && !visited[spouseId]) {
                    nextSpouseX += 1.5; // ขยับพิกัดคู่สมรสถัดไปทางขวา
                    d.n.push({ x1: currentX, y1: currentY, x2: nextSpouseX, y2: currentY, type: "partner" });
                    traverse(spouseId, nextSpouseX, currentY);
                }
            });
        }

        // 2. จัดตำแหน่งลูกๆ ของบุคคลนั้น
        if (person.c && person.c.length > 0) {
            let totalChildren = person.c.length;
            // คำนวณขยายขอบกว้างตามจำนวนลูก
            let startX = currentX - ((totalChildren - 1) * 1.3) / 2;

            // เส้นดิ่งหลักจากพ่อแม่ลงมา
            d.n.push({ x1: currentX, y1: currentY, x2: currentX, y2: currentY + 0.5, type: "vertical" });
            
            // เส้นแนวนอนกระจายสายเลือด
            if (totalChildren > 1) {
                d.n.push({ x1: startX, y1: currentY + 0.5, x2: startX + (totalChildren - 1) * 1.3, y2: currentY + 0.5, type: "horizontal" });
            }

            person.c.forEach((childId, index) => {
                let childX = startX + index * 1.3;
                let childY = currentY + 1.2;
                
                // เส้นดิ่งย่อยเข้าหัวกล่องลูก
                d.n.push({ x1: childX, y1: currentY + 0.5, x2: childX, y2: childY, type: "vertical" });
                traverse(childId, childX, childY);
            });
        }
    }

    traverse(focusId, 0, 0);
    return d;
}

/**
 * 3. ระบบวาดผังขึ้นหน้าจอจริง (DOM Rendering Engine)
 */
function renderFamilyTree(layoutData, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ""; 

    const scaleX = 180; // เพิ่มความห่างในแนวนอนเพื่อไม่ให้ชื่อยาวๆ ชนกัน
    const scaleY = 150; 
    
    // ตั้งพิกัดจุดศูนย์กลางจอ
    const offsetX = container.offsetWidth / 2;
    const offsetY = 50;

    // วาดเส้นทั้งหมด
    layoutData.n.forEach(line => {
        let x1 = offsetX + line.x1 * scaleX;
        let y1 = offsetY + line.y1 * scaleY;
        let x2 = offsetX + line.x2 * scaleX;
        let y2 = offsetY + line.y2 * scaleY;

        let dx = x2 - x1;
        let dy = y2 - y1;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);

        let lineDiv = document.createElement("div");
        lineDiv.className = `tree-line ${line.type}`;
        lineDiv.style.width = distance + "px";
        lineDiv.style.left = x1 + "px";
        lineDiv.style.top = y1 + "px";
        lineDiv.style.transform = `rotate(${angle}rad)`;
        
        container.appendChild(lineDiv);
    });

    // วาดกล่องบุคคล
    for (let id in layoutData.e) {
        let node = layoutData.e[id];
        let px = offsetX + node.x * scaleX;
        let py = offsetY + node.y * scaleY;

        let box = document.createElement("div");
        box.className = `tree-box ${node.person.g}`;
        box.style.left = (px - 60) + "px"; 
        box.style.top = (py - 25) + "px";  
        
        box.innerHTML = `<strong>${node.person.name}</strong><br><small>ID: ${node.person.id}</small>`;
        container.appendChild(box);
    }
}
