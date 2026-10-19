/**
 * CONFIGURATION
 */
const CONFIG = {
    BACKEND_URL: "https://script.google.com/macros/s/AKfycbw7N7oDZaISZz6KklFLEhmSXbhYsu7kVBQpX1hjK91WSk9Eg2lrepowQ1M1fcDJXg86hQ/exec", 
    DEADLINE: "2026-11-30T23:59:00-05:00", // Enforces Nov 30, 2026, 11:59 PM EST
    MAX_FILE_SIZE_MB: 10
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

// Convert File to Base64 Promise for Google Apps Script transit
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
        // STEP
