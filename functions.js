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
    let currentXOffset = 0; // ตัวนับพิกัดสะสมเพื่อป้องกันกล่องชนกันในแนวนอน

    function traverse(id, currentY) {
        if (!id || visited[id] || !familyData[id]) return null;
        visited[id] = true;

        let person = familyData[id];
        
        // กำหนดพิกัด X ให้กับคนนี้ตามตำแหน่งสะสมปัจจุบัน
        let myX = currentXOffset;
        d.e[id] = { person: person, x: myX, y: currentY };
        currentXOffset += 1.4; // ขยับพื้นที่เผื่อไว้สำหรับคนถัดไป

        // 1. จัดตำแหน่งให้คู่สมรสทุกคน (ถ้ามีหลายคน ขยับเรียงไปทางขวา)
        if (person.spouses && person.spouses.length > 0) {
            person.spouses.forEach((spouseId) => {
                if (familyData[spouseId] && !visited[spouseId]) {
                    let spouseX = currentXOffset;
                    d.n.push({ x1: myX, y1: currentY, x2: spouseX, y2: currentY, type: "partner" });
                    
                    visited[spouseId] = true;
                    d.e[spouseId] = { person: familyData[spouseId], x: spouseX, y: currentY };
                    currentXOffset += 1.4; // ขยับหนีพิกัดเดิมเพื่อไม่ให้คู่สมรสทับกัน
                }
            });
        }

        // 2. จัดตำแหน่งให้ลูกๆ แบบขยับพิกัดแผ่ออกทางขวาเรื่อยๆ
        if (person.c && person.c.length > 0) {
            let childY = currentY + 1.2;
            let childXCoordinates = [];

            // สั่งลูปขยายพิกัดลูกทุกคนลงไปชั้นล่างก่อน เพื่อเก็บค่าพิกัด X ของลูกแต่ละคน
            person.c.forEach((childId) => {
                if (!visited[childId]) {
                    let cX = currentXOffset; // ยึดพิกัดล่าสุดที่ยังว่างอยู่
                    childXCoordinates.push(cX);
                    traverse(childId, childY);
                } else if (d.e[childId]) {
                    childXCoordinates.push(d.e[childId].x);
                }
            });

            // เมื่อได้ตำแหน่ง X ของลูกทุกคนแล้ว จึงนำมาลากเส้นเชื่อมโยงให้ตรงช่อง
            if (childXCoordinates.length > 0) {
                let minChildX = Math.min(...childXCoordinates);
                let maxChildX = Math.max(...childXCoordinates);

                // เส้นดิ่งหลักวิ่งลงมาจากตรงกลางระหว่างพ่อแม่
                d.n.push({ x1: myX, y1: currentY, x2: myX, y2: currentY + 0.4, type: "vertical" });
                
                // เส้นแนวนอนยาวรองรับขอบเขตลูกทั้งหมด
                d.n.push({ x1: minChildX, y1: currentY + 0.4, x2: maxChildX, y2: currentY + 0.4, type: "horizontal" });

                // ลากเส้นดิ่งย่อยจากเส้นแนวนอนหลัก วิ่งเข้าหัวกล่องของลูกแต่ละคน
                childXCoordinates.forEach((cX) => {
                    d.n.push({ x1: cX, y1: currentY + 0.4, x2: cX, y2: childY, type: "vertical" });
                });
            }
        }
    }

    traverse(focusId, 0);
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
