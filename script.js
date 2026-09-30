/**
 * CONFIGURATION
 * Do NOT put secret API keys here.
 */
const CONFIG = {
    // ⚠️ REPLACE THIS WITH YOUR APPS SCRIPT WEB APP URL after deployment
    BACKEND_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec", 
    DEADLINE: "2026-11-30T23:59:00-05:00", // EST timezone explicitly[cite: 1]
    MAX_FILE_SIZE_MB: 10 // Restricted to 10MB to guarantee stable Google Apps Script base64 processing
};

// Check deadline on load
document.addEventListener("DOMContentLoaded", () => {
    const now = new Date();
    const deadline = new Date(CONFIG.DEADLINE);
    
    if (now > deadline) {
        document.getElementById('scholarshipForm').classList.add('hidden');
        document.getElementById('deadlineBanner').classList.remove('hidden');
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

// File Validation & UI
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

// Convert File to Base64 Promise
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

// Form Submission Logic
document.getElementById('scholarshipForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const systemError = document.getElementById('system-error');
    
    // 1. Validation
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

    // 2. Prepare Data
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

    try {
        // STEP A: Initialize Application (Creates Folder and DB Row)
        loadingText.textContent = "Initializing application securely...";
        
        let initResponse = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'initialize', data: formData })
        });
        
        let initData = await initResponse.json();
        
        if (!initData.success) throw new Error(initData.error || "Initialization failed.");
        
        const { submissionId, folderId, rowIndex } = initData;

        // STEP B: Sequentially upload files
        const fileInputs = [
            { id: 'govId', name: 'Government ID' },
            { id: 'studentId', name: 'Student ID' },
            { id: 'transcript', name: 'Transcript' },
            { id: 'proofOfAdmission', name: 'Proof of Admission' },
            { id: 'recLetter', name: 'Recommendation Letter' },
            { id: 'essay', name: 'Essay' }
        ];

        let uploadCount = 0;
        let filesToUpload = fileInputs.filter(f => document.getElementById(f.id).files.length > 0);

        for (let fileConfig of filesToUpload) {
            const fileObj = document.getElementById(fileConfig.id).files[0];
            uploadCount++;
            loadingText.textContent = `Uploading document ${uploadCount} of ${filesToUpload.length}: ${fileConfig.name}...`;
            
            const base64Data = await fileToBase64(fileObj);
            
            let uploadRes = await fetch(CONFIG.BACKEND_URL, {
                method: 'POST',
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

        // STEP C: Finalize Application (Update status, send email)
        loadingText.textContent = "Finalizing submission...";
        await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'finalize', rowIndex: rowIndex, submissionId: submissionId, email: formData.email, name: formData.fullName })
        });

        // Show Success
        form.classList.add('hidden');
        document.getElementById('successState').classList.remove('hidden');
        document.getElementById('displayAppId').textContent = submissionId;
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Submission Error:", error);
        systemError.textContent = "We were unable to complete your submission. Please check your connection and try again. If the issue persists, contact scholarships@cig.ca.";
        systemError.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        loadingState.classList.add('hidden');
    }
});
