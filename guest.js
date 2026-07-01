import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const supabaseUrl = 'https://eadokkifrdqrktjkmbjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZG9ra2lmcmRxcmt0amttYmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzEyODksImV4cCI6MjA5ODE0NzI4OX0.qufxpCTnuf31nFN9BnbfqeLuM6RZ3mpE0qFXOkqvImM';

const supabase = createClient(supabaseUrl, supabaseKey);

let currentSurvey = null;
let currentQuestions = [];
let currentWorkstation = localStorage.getItem('guest_workstation') || '';
let allWorkstations = [];

document.addEventListener('DOMContentLoaded', initGuestPage);

async function initGuestPage() {
  // Load workstations for selection
  await loadWorkstations();

  // Check if workstation already selected
  if (currentWorkstation) {
    showWorkstation(currentWorkstation);
    await loadAvailableSurveys();
  } else {
    showWorkstationSelection();
  }

  setupEventListeners();
}

async function loadWorkstations() {
  try {
    const { data: workstations, error } = await supabase
      .from('workstations')
      .select('name')
      .order('name', { ascending: true });

    if (error && error.code !== 'PGRST204') throw error;
    allWorkstations = workstations || [];

    // Populate dropdown
    const select = document.getElementById('workstation-select');
    if (select && allWorkstations.length > 0) {
      select.innerHTML = '<option value="">-- Select Workstation --</option>' +
        allWorkstations.map(w => `<option value="${escapeHtml(w.name)}">${escapeHtml(w.name)}</option>`).join('');
    }
  } catch (error) {
    console.error('Error loading workstations:', error);
    allWorkstations = [];
  }
}

function showWorkstationSelection() {
  document.getElementById('workstation-select-container').style.display = 'block';
  document.querySelector('.guest-container').style.display = 'none';
  document.getElementById('workstation-display').style.display = 'none';

  // Setup form
  const form = document.getElementById('workstation-select-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const selectValue = document.getElementById('workstation-select').value;
    const manualValue = document.getElementById('manual-workstation').value.trim();
    const workstation = manualValue || selectValue;

    if (!workstation) {
      showToast('Please select or enter a workstation', 'error');
      return;
    }

    currentWorkstation = workstation;
    localStorage.setItem('guest_workstation', workstation);
    showWorkstation(workstation);
    await loadAvailableSurveys();
  };
}

function showWorkstation(workstation) {
  document.getElementById('workstation-select-container').style.display = 'none';
  document.querySelector('.guest-container').style.display = 'block';
  document.getElementById('workstation-display').style.display = 'flex';
  document.getElementById('current-workstation').textContent = workstation;
}

function setupEventListeners() {
  // Change workstation button
  document.getElementById('change-workstation')?.addEventListener('click', () => {
    localStorage.removeItem('guest_workstation');
    currentWorkstation = '';
    showWorkstationSelection();
  });

  document.getElementById('back-to-list').addEventListener('click', (e) => {
    e.preventDefault();
    showSurveyList();
  });

  document.getElementById('submit-another').addEventListener('click', () => {
    showSurveyList();
  });
}

async function loadAvailableSurveys() {
  try {
    const { data: surveys, error } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter surveys by workstation
    const availableSurveys = (surveys || []).filter(survey => {
      // If no assignment, show to everyone
      if ((!survey.assigned_departments || survey.assigned_departments.length === 0) &&
          (!survey.assigned_workstations || survey.assigned_workstations.length === 0)) {
        return true;
      }
      // Check if workstation is in assigned list
      if (survey.assigned_workstations && survey.assigned_workstations.includes(currentWorkstation)) {
        return true;
      }
      // Check if department matches (we'd need to look up workstation's department)
      // For now, just check workstation directly
      return false;
    });

    const container = document.getElementById('available-surveys-list');

    if (!availableSurveys || availableSurveys.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No surveys available for your workstation.</p></div>';
      return;
    }

    container.innerHTML = availableSurveys.map(survey => `
      <button class="survey-option" data-id="${survey.id}">
        <h3>${escapeHtml(survey.title)}
          <span class="type-badge ${survey.type}">${survey.type}</span>
        </h3>
        <p>${escapeHtml(survey.description || 'No description provided')}</p>
      </button>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.survey-option').forEach(btn => {
      btn.addEventListener('click', () => openSurvey(btn.dataset.id));
    });
  } catch (error) {
    console.error('Error loading surveys:', error);
    showToast('Failed to load surveys', 'error');
  }
}

async function openSurvey(surveyId) {
  try {
    const { data: survey, error } = await supabase
      .from('surveys')
      .select('*, questions(*)')
      .eq('id', surveyId)
      .single();

    if (error) throw error;

    currentSurvey = survey;
    currentQuestions = survey.questions.sort((a, b) => a.order_index - b.order_index);
    const isChecklist = survey.type === 'checklist';

    document.getElementById('survey-list-container').style.display = 'none';
    document.getElementById('survey-form-container').style.display = 'block';

    const formContent = document.getElementById('survey-form-content');
    formContent.innerHTML = `
      <header class="page-header" style="text-align: left; margin-bottom: 1.5rem;">
        <span class="type-badge ${survey.type}">${survey.type}</span>
        <h1 style="font-size: 1.75rem;">${escapeHtml(survey.title)}</h1>
        <p class="subtitle">${escapeHtml(survey.description || '')}</p>
      </header>
      <form id="survey-response-form">
        <div class="guest-info-section">
          <h3>Your Information</h3>
          <div class="guest-info-grid">
            <div class="form-group">
              <label for="guest-name">First Name <span class="required">*</span></label>
              <input type="text" id="guest-name" placeholder="Enter your first name" required />
            </div>
            <div class="form-group">
              <label for="guest-surname">Surname <span class="required">*</span></label>
              <input type="text" id="guest-surname" placeholder="Enter your surname" required />
            </div>
            <div class="form-group">
              <label for="guest-workstation">Workstation</label>
              <input type="text" id="guest-workstation" value="${escapeHtml(currentWorkstation)}" readonly style="background: #f1f5f9;" />
            </div>
          </div>
          <div class="signature-section">
            <label for="guest-signature">Signature <span class="required">*</span></label>
            <canvas id="signature-canvas" width="400" height="120"></canvas>
            <div class="signature-actions">
              <button type="button" id="clear-signature" class="btn btn-secondary btn-small">Clear</button>
            </div>
          </div>
        </div>
        <div id="questions-blocks">
          <h3 style="margin-bottom: 1rem;">${isChecklist ? 'Checklist Items' : 'Questions'}</h3>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Response</button>
      </form>
    `;

    // Setup signature canvas
    setupSignatureCanvas();

    const questionsBlocks = document.getElementById('questions-blocks');

    currentQuestions.forEach((q, idx) => {
      const block = document.createElement('div');
      block.className = 'question-block';
      block.dataset.id = q.id;

      let inputHtml = '';

      // For checklist surveys, show checkbox on the right
      if (isChecklist) {
        inputHtml = `
          <div class="checklist-item">
            <span class="checklist-number">${idx + 1}.</span>
            <label for="check-${q.id}" class="checklist-label">${escapeHtml(q.question_text)}</label>
            <input type="checkbox" name="q-${q.id}" id="check-${q.id}" class="checklist-checkbox" />
          </div>
        `;
      } else if (q.question_type === 'text') {
        inputHtml = `<textarea name="q-${q.id}" rows="3" placeholder="Your answer" required></textarea>`;
      } else if (q.question_type === 'multiple_choice') {
        const options = q.options || [];
        inputHtml = options.map(opt => `
          <label class="radio-option">
            <input type="radio" name="q-${q.id}" value="${escapeHtml(opt)}" required />
            ${escapeHtml(opt)}
          </label>
        `).join('');
      } else if (q.question_type === 'checkbox') {
        const options = q.options || [];
        inputHtml = options.map(opt => `
          <label class="checkbox-option">
            <input type="checkbox" name="q-${q.id}" value="${escapeHtml(opt)}" />
            ${escapeHtml(opt)}
          </label>
        `).join('');
      }

      block.innerHTML = inputHtml;
      questionsBlocks.appendChild(block);
    });

    // Add form submit handler
    document.getElementById('survey-response-form').addEventListener('submit', handleSubmitResponse);
  } catch (error) {
    console.error('Error opening survey:', error);
    showToast('Failed to load survey', 'error');
  }
}

let signaturePad = null;

function setupSignatureCanvas() {
  const canvas = document.getElementById('signature-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
  };

  const stopDrawing = () => {
    isDrawing = false;
  };

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);

  document.getElementById('clear-signature').addEventListener('click', () => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  signaturePad = canvas;
}

function isSignatureEmpty() {
  const canvas = document.getElementById('signature-canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const data = imageData.data;
  let nonBackgroundPixels = 0;
  const bgColor = [248, 250, 252];

  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - bgColor[0]) > 10 ||
        Math.abs(data[i+1] - bgColor[1]) > 10 ||
        Math.abs(data[i+2] - bgColor[2]) > 10) {
      nonBackgroundPixels++;
    }
  }

  return nonBackgroundPixels < 50;
}

async function handleSubmitResponse(e) {
  e.preventDefault();

  const guestName = document.getElementById('guest-name').value.trim();
  const guestSurname = document.getElementById('guest-surname').value.trim();
  const workstation = document.getElementById('guest-workstation').value.trim();
  const signatureData = signaturePad.toDataURL();

  if (!guestName || !guestSurname || !workstation) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (isSignatureEmpty()) {
    showToast('Please provide your signature', 'error');
    return;
  }

  try {
    const { data: response, error: responseError } = await supabase
      .from('responses')
      .insert({
        survey_id: currentSurvey.id,
        guest_name: guestName,
        surname: guestSurname,
        workstation: workstation,
        signature: signatureData
      })
      .select()
      .single();

    if (responseError) throw responseError;

    const answers = [];
    const isChecklist = currentSurvey.type === 'checklist';

    currentQuestions.forEach(q => {
      let answer = '';

      if (isChecklist) {
        const checkbox = document.querySelector(`input[name="q-${q.id}"]`);
        answer = checkbox?.checked ? 'Completed' : 'Not completed';
      } else if (q.question_type === 'text') {
        const textarea = document.querySelector(`textarea[name="q-${q.id}"]`);
        answer = textarea?.value?.trim() || '';
      } else if (q.question_type === 'multiple_choice') {
        const selected = document.querySelector(`input[name="q-${q.id}"]:checked`);
        answer = selected?.value || '';
      } else if (q.question_type === 'checkbox') {
        const checked = document.querySelectorAll(`input[name="q-${q.id}"]:checked`);
        answer = Array.from(checked).map(c => c.value).join(', ');
      }

      answers.push({
        response_id: response.id,
        question_id: q.id,
        answer_text: answer
      });
    });

    const { error: answersError } = await supabase
      .from('answers')
      .insert(answers);

    if (answersError) throw answersError;

    document.getElementById('survey-form-container').style.display = 'none';
    document.getElementById('success-container').style.display = 'block';
  } catch (error) {
    console.error('Error submitting response:', error);
    showToast('Failed to submit response', 'error');
  }
}

function showSurveyList() {
  document.getElementById('survey-form-container').style.display = 'none';
  document.getElementById('success-container').style.display = 'none';
  document.getElementById('survey-list-container').style.display = 'block';
  currentSurvey = null;
  currentQuestions = [];
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 2000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
