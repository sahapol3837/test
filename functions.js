/**
 * 1. ฟังก์ชันช่วยแปลงข้อความจาก CSV ให้เป็นโครงสร้างข้อมูลผังเครือญาติ (CSV Parser)
 */
function parseCSVToFamilyData(csvText) {
    const lines = csvText.trim().split("\n");
    const familyData = {};

    // 1. อ่านและทำความสะอาดชื่อคอลัมน์จาก Header บรรทัดแรก
    const headers = lines[0].split(/\t|,/).map(h => h.trim().toLowerCase());
    
    // หาตำแหน่ง Index ของแต่ละคอลัมน์ป้องกันการสลับตำแหน่ง
    const idIdx = headers.indexOf("id");
    const nameIdx = headers.indexOf("name");
    const fatherIdx = headers.findIndex(h => h.includes("father"));
    const motherIdx = headers.findIndex(h => h.includes("mother"));
    const spouseIdx = headers.findIndex(h => h.includes("spouse"));
    const genderIdx = headers.findIndex(h => h.includes("gender"));

    // 2. ลูปอ่านข้อมูลรายบรรทัด
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // แยกข้อมูลคอลัมน์ด้วย Tab หรือ Comma
        const cols = lines[i].split(/\t|,/);
        
        // ใช้ .trim() ทุกตัวแปรเพื่อตัดช่องว่างลึกลับออกให้หมด
        const id = cols[idIdx] ? cols[idIdx].trim() : "";
        const name = cols[nameIdx] ? cols[nameIdx].trim() : "";
        const father = cols[fatherIdx] ? cols[fatherIdx].trim() : "";
        const mother = cols[motherIdx] ? cols[motherIdx].trim() : "";
        const spouseRaw = cols[spouseIdx] ? cols[spouseIdx].trim() : "";
        const gender = cols[genderIdx] ? cols[genderIdx].trim() : "";

        if (!id) continue; // ถ้าไม่มี ID ให้ข้ามบรรทัดนั้น

        // จัดการแยกคู่สมรสด้วยเครื่องหมาย | และดักจับช่องว่างรอบๆ ID คู่สมรสด้วย
        const spouses = spouseRaw ? spouseRaw.split("|").map(s => s.trim()).filter(s => s !== "") : [];

        familyData[id] = {
            id: id,
            name: name,
            father: father,
            mother: mother,
            spouses: spouses,
            g: (gender === "ช") ? "m" : "f",
            c: [] // เตรียมพื้นที่สำหรับลูกๆ
        };
    }

    // 3. ผูกความสัมพันธ์หาลูก (Children) ให้พ่อและแม่
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
