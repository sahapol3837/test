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

    // ฟังก์ชันย่อยช่วยค้นหาคู่แต่งงานทั้งหมดที่ยังไม่ได้เรนเดอร์
    function getUnvisitedSpouses(person) {
        let list = [];
        if (person.spouses) {
            person.spouses.forEach(sid => {
                if (familyData[sid] && !visited[sid]) list.push(sid);
            });
        }
        return list;
    }

    // ฟังก์ชันคำนวณหลัก: จะส่งคืนค่า "พิกัดขอบขวาสุด" ที่ใช้ไปในกิ่งนั้นๆ เพื่อให้คนถัดไปขยับหลบได้พอดี
    function traverse(id, currentX, currentY) {
        if (!id || visited[id] || !familyData[id]) return currentX;
        visited[id] = true;

        let person = familyData[id];
        let unvisitedSpouses = getUnvisitedSpouses(person);
        
        // 1. คำนวณความกว้างพื้นฐานของตัวเองและคู่สมรส
        // ปู่/ตา 1 กล่อง + คู่สมรสทุกคน กล่องละ 1.4 หน่วย
        let myWidth = 1 + (unvisitedSpouses.length * 1.4);
        let myEndX = currentX + myWidth;

        // วาดกล่องของตัวเองก่อน
        d.e[id] = { person: person, x: currentX, y: currentY };

        // วาดกล่องคู่สมรสเรียงต่อกันไปทางขวา พร้อมลากเส้นแต่งงาน
        let nextSpouseX = currentX;
        unvisitedSpouses.forEach((spouseId) => {
            nextSpouseX += 1.4;
            visited[spouseId] = true;
            d.e[spouseId] = { person: familyData[spouseId], x: nextSpouseX, y: currentY };
            d.n.push({ x1: currentX, y1: currentY, x2: nextSpouseX, y2: currentY, type: "partner" });
        });

        // หาจุดกึ่งกลางระหว่าง พ่อ กับ แม่คนแรก (ใช้เป็นจุดปล่อยเส้นดิ่งลงมาหาลูก)
        let centerParentX = currentX;
        if (unvisitedSpouses.length > 0) {
            centerParentX = (currentX + (currentX + 1.4)) / 2;
        }

        // 2. คำนวณและจัดตำแหน่งกลุ่มลูกๆ 
        if (person.c && person.c.length > 0) {
            let childY = currentY + 1.2;
            let childXCoordinates = [];
            let childNextX = currentX; // ให้ลูกคนแรกเริ่มที่พิกัดซ้ายสุดของบ้านตัวเอง

            person.c.forEach((childId) => {
                if (!visited[childId]) {
                    // วนลูปวาดกิ่งของลูกคนนี้ และรับค่าพิกัดขอบขวาสุดที่ลูกคนนี้ใช้ไปกลับมา
                    let childEndX = traverse(childId, childNextX, childY);
                    
                    // บันทึกตำแหน่ง X ของลูกคนนี้เพื่อเอาไว้ลากเส้นเชื่อม
                    if (d.e[childId]) {
                        childXCoordinates.push(d.e[childId].x);
                    }
                    
                    // ลูกคนถัดไปต้องเริ่มต่อจากขอบขวาสุดของกิ่งพี่คนก่อนหน้า + ช่องว่างขยับหนีอีกเล็กน้อย
                    childNextX = Math.max(childEndX, childNextX + 1.4);
                } else if (d.e[childId]) {
                    childXCoordinates.push(d.e[childId].x);
                }
            });

            // ปรับขนาดความกว้างรวมของบ้านนี้ ถ้ากิ่งของลูกๆ แผ่ออกไปไกลกว่าตัวพ่อแม่
            if (childNextX > myEndX) {
                myEndX = childNextX;
            }

            // ลากเส้นเชื่อมโยงระบบสายเลือดเข้าหาลูกทุกคนอย่างแม่นยำ
            if (childXCoordinates.length > 0) {
                let minChildX = Math.min(...childXCoordinates);
                let maxChildX = Math.max(...childXCoordinates);

                // 1. เส้นดิ่งหลักวิ่งลงมาจากกึ่งกลางพ่อแม่
                d.n.push({ x1: centerParentX, y1: currentY, x2: centerParentX, y2: currentY + 0.4, type: "vertical" });
                
                // 2. เส้นแนวนอนเชื่อมจุดดิ่งพ่อแม่ วิ่งไปหาพิกัดซ้ายสุดและขวาสุดของกลุ่มลูก
                d.n.push({ x1: Math.min(centerParentX, minChildX), y1: currentY + 0.4, x2: Math.max(centerParentX, maxChildX), y2: currentY + 0.4, type: "horizontal" });

                // 3. เส้นดิ่งย่อยสับลงหัวกล่องลูกแต่ละคน
                childXCoordinates.forEach((cX) => {
                    d.n.push({ x1: cX, y1: currentY + 0.4, x2: cX, y2: childY, type: "vertical" });
                });
            }
        }

        return myEndX; // ส่งคืนค่าพิกัดขวาสุดที่กิ่งนี้ใช้ไปทั้งหมด
    }

    // เริ่มคำนวณจาก ID 1 แผ่พิกัดเริ่มต้นที่ X = 0
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
