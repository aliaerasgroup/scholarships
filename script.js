const CONFIG = {
    BACKEND_URL: "", // We will configure this in the deployment phase
    DEADLINE: "2026-11-30T23:59:00-05:00", // Enforces Nov 30, 2026, 11:59 PM EST
    MAX_FILE_SIZE_MB: 10
};

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

// Temporary submission handler to validate frontend before backend integration
document.getElementById('scholarshipForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    let isValid = true;
    const requiredInputs = form.querySelectorAll('[required]');
    
    form.querySelectorAll('.form-group, .upload-card, .declaration-section').forEach(el => el.classList.remove('invalid'));
    
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

    // UI Feedback pending backend connection
    document.getElementById('submitBtn').classList.add('hidden');
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('loadingText').textContent = "Frontend validation complete. Ready for backend deployment step.";
});
