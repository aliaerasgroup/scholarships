const CONFIG = {
    BACKEND_URL: "https://script.google.com/macros/s/AKfycbw7N7oDZaISZz6KklFLEhmSXbhYsu7kVBQpX1hjK91WSk9Eg2lrepowQ1M1fcDJXg86hQ/exec", 
    DEADLINE: "2026-11-30T23:59:00-05:00", // Enforces Nov 30, 2026, 11:59 PM EST
    MAX_FILE_SIZE_MB: 10
};

document.addEventListener("DOMContentLoaded", () => {
    try {
        const now = Date.now();
        const deadline = new Date(CONFIG.DEADLINE).getTime();
        
        if (now > deadline) {
            document.getElementById('scholarshipForm').classList.add('hidden');
            document.getElementById('introSection').classList.add('hidden');
            document.getElementById('deadlineBanner').classList.remove('hidden');
        }
    } catch (error) {
        console.error("Date check failed:", error);
    }
});

function toggleOtherRelation() {
    const select = document.getElementById('refRelation');
    const otherInput = document.getElementById('refRelationOther');
    if (select.value === 'Other') {
        otherInput.classList.remove('hidden');
        otherInput.required = true;
    } else {
        otherInput.classList.add('hidden');
        otherInput.required = false;
        otherInput.value = '';
    }
}

function handleFileSelect(event, cardId) {
    const file = event.target.files[0];
    const nameDisplay = document.getElementById(`filename-${cardId}`);
    const card = document.getElementById(`card-${cardId}`);
    
    card.classList.remove('invalid');
    
    if (!file) {
        nameDisplay.textContent = "No file selected";
        return;
    }

    if (file.type !== "application/pdf") {
        event.target.value = '';
        nameDisplay.textContent = "Error: File must be a PDF";
        card.classList.add('invalid');
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        event.target.value = '';
        nameDisplay.textContent = `Error: File exceeds ${CONFIG.MAX_FILE_SIZE_MB}MB limit`;
        card.classList.add('invalid');
        return;
    }

    nameDisplay.textContent = file.name;
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

document.getElementById('scholarshipForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // STOP native page reload immediately
    
    try {
        const form = e.target;
        const submitBtn = document.getElementById('submitBtn');
        const loadingState = document.getElementById('loadingState');
        const loadingText = document.getElementById('loadingText');
        const systemError = document.getElementById('system-error');
        
        let isValid = true;
        const requiredInputs = form.querySelectorAll('[required]');
        
        // Clear previous errors
        form.querySelectorAll('.form-group, .upload-card, .declaration-section').forEach(el => el.classList.remove('invalid'));
        systemError.classList.add('hidden');
        
        for (let input of requiredInputs) {
            if (!input.value || (input.type === 'checkbox' && !input.checked)) {
                isValid = false;
                let parent = input.closest('.form-group') || input.closest('.upload-card') || input.closest('.declaration-section');
                if (parent) parent.classList.add('invalid');
            }
        }
        
        if (!isValid) {
            const firstInvalid = form.querySelector('.invalid');
            if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        submitBtn.classList.add('hidden');
        loadingState.classList.remove('hidden');

        const formData = {
            fullName: form.fullName.value.trim(),
            age: form.age.value,
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            program: form.program.value.trim(),
            membershipEmail: form.membershipEmail.value.trim(),
            refName: form.refName.value.trim(),
            refPhone: form.refPhone.value.trim(),
            refEmail: form.refEmail.value.trim(),
            refTitle: form.refTitle.value.trim(),
            refRelation: form.refRelation.value === 'Other' ? form.refRelationOther.value : form.refRelation.value,
            timestamp: new Date().toISOString()
        };

        // STEP A: Initialize
        loadingText.textContent = "Initializing secure connection...";
        let initResponse = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'initialize', data: formData })
        });
        
        let initData = await initResponse.json();
        if (!initData.success) throw new Error(initData.error || "Initialization failed.");
        
        const { submissionId, folderId, rowIndex } = initData;

        // STEP B: Upload
        const fileInputs = [
            { id: 'govId', name: 'Government ID' },
            { id: 'studentId', name: 'Student ID' },
            { id: 'transcript', name: 'Transcript' },
            { id: 'proofOfAdmission', name: 'Proof of Admission' },
            { id: 'recLetter', name: 'Recommendation Letter' },
            { id: 'essay', name: 'Essay' }
        ];

        let filesToUpload = fileInputs.filter(f => document.getElementById(f.id).files.length > 0);

        for (let i = 0; i < filesToUpload.length; i++) {
            const fileConfig = filesToUpload[i];
            const fileObj = document.getElementById(fileConfig.id).files[0];
            
            loadingText.textContent = `Uploading document ${i + 1} of ${filesToUpload.length}: ${fileConfig.name}...`;
            const base64Data = await fileToBase64(fileObj);
            
            let uploadRes = await fetch(CONFIG.BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'uploadFile',
                    submissionId: submissionId,
                    folderId: folderId,
                    rowIndex: rowIndex,
                    fileId: fileConfig.id,
                    fileName: `${submissionId}_${fileConfig.id}.pdf`,
                    mimeType: fileObj.type,
                    fileData: base64Data
                })
            });
            
            let uploadResult = await uploadRes.json();
            if (!uploadResult.success) throw new Error(`Failed to upload ${fileConfig.name}`);
        }

        // STEP C: Finalize
        loadingText.textContent = "Finalizing submission...";
        await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'finalize', 
                rowIndex: rowIndex, 
                submissionId: submissionId, 
                email: formData.email, 
                name: formData.fullName 
            })
        });

        // Show Success Page
        form.classList.add('hidden');
        document.getElementById('introSection').classList.add('hidden');
        document.getElementById('successState').classList.remove('hidden');
        document.getElementById('displayAppId').textContent = submissionId;
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Submission Error:", error);
        const systemError = document.getElementById('system-error');
        systemError.textContent = "We were unable to complete your submission. Please check your connection and try again.";
        systemError.classList.remove('hidden');
        document.getElementById('submitBtn').classList.remove('hidden');
        document.getElementById('loadingState').classList.add('hidden');
    }
});
