import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const supabaseUrl = 'https://eadokkifrdqrktjkmbjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZG9ra2lmcmRxcmt0amttYmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzEyODksImV4cCI6MjA5ODE0NzI4OX0.qufxpCTnuf31nFN9BnbfqeLuM6RZ3mpE0qFXOkqvImM';

const supabase = createClient(supabaseUrl, supabaseKey);

let questionCount = 0;
let editQuestionCount = 0;
let allResponsesData = [];
let allDepartments = [];
let allWorkstations = [];

document.addEventListener('DOMContentLoaded', async () => {
  const isOwnerPage = document.getElementById('owner-page');

  if (isOwnerPage) {
    setupAuth();
    setupTabs();
    setupPdfDownload();
    setupFilters();
    setupDocumentImport();
  }
});

function setupAuth() {
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  const showSignup = document.getElementById('show-signup');
  const showSignin = document.getElementById('show-signin');
  const signinContainer = document.getElementById('signin-form-container');
  const signupContainer = document.getElementById('signup-form-container');
  const logoutBtn = document.getElementById('logout-btn');

  showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    signinContainer.style.display = 'none';
    signupContainer.style.display = 'block';
  });

  showSignin.addEventListener('click', (e) => {
    e.preventDefault();
    signupContainer.style.display = 'none';
    signinContainer.style.display = 'block';
  });

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    btn.textContent = 'Sign In';

    if (error) {
      showNotification(error.message || 'Sign in failed', 'error');
    } else {
      showNotification('Welcome back!', 'success');
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      showNotification('Passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    const { data, error } = await supabase.auth.signUp({ email, password });
    btn.disabled = false;
    btn.textContent = 'Create Account';

    if (error) {
      showNotification(error.message || 'Sign up failed', 'error');
    } else if (data.user) {
      showNotification('Account created! You are now signed in.', 'success');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    (async () => {
      if (session) {
        await showMainApp();
      } else {
        showAuthScreen();
      }
    })();
  });
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

async function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  await loadDepartments();
  await loadWorkstations();
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');

      if (tabId === 'surveys') loadSurveys();
      if (tabId === 'responses') loadResponses();
      if (tabId === 'qrcode') generateQRCode();
      if (tabId === 'departments') loadDepartments();
      if (tabId === 'workstations') loadWorkstations();
    });
  });

  setupCreateForm();
  loadSurveys();
}

function setupCreateForm() {
  const createForm = document.getElementById('create-form');
  const addQuestionBtn = document.getElementById('add-question-btn');
  const editForm = document.getElementById('edit-form');
  const editAddQuestionBtn = document.getElementById('edit-add-question-btn');

  addQuestionBtn.addEventListener('click', () => addQuestion('questions-list'));
  editAddQuestionBtn.addEventListener('click', () => addQuestion('edit-questions-list'));

  createForm.addEventListener('submit', handleCreateSurvey);
  editForm.addEventListener('submit', handleEditSurvey);

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
  });
}

function addQuestion(containerId, questionText = '', questionType = 'text', options = []) {
  const container = document.getElementById(containerId);
  const count = containerId === 'questions-list' ? ++questionCount : ++editQuestionCount;

  const questionItem = document.createElement('div');
  questionItem.className = 'question-item';
  questionItem.innerHTML = `
    <div class="question-header">
      <span>Question ${count}</span>
      <button type="button" class="btn btn-secondary btn-small remove-question">&times;</button>
    </div>
    <div class="form-group">
      <input type="text" placeholder="Enter question text" class="question-text" value="${escapeHtml(questionText)}" required />
    </div>
    <div class="form-group">
      <select class="question-type">
        <option value="text" ${questionType === 'text' ? 'selected' : ''}>Text Input</option>
        <option value="multiple_choice" ${questionType === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
        <option value="checkbox" ${questionType === 'checkbox' ? 'selected' : ''}>Checkboxes</option>
      </select>
    </div>
    <div class="options-container" style="display: ${questionType !== 'text' ? 'block' : 'none'};">
      <label>Options (one per line)</label>
      <textarea class="question-options" placeholder="Option 1&#10;Option 2&#10;Option 3">${options.join('\n')}</textarea>
    </div>
  `;

  container.appendChild(questionItem);

  questionItem.querySelector('.remove-question').addEventListener('click', () => {
    questionItem.remove();
    updateQuestionNumbers(container);
  });

  const typeSelect = questionItem.querySelector('.question-type');
  const optionsContainer = questionItem.querySelector('.options-container');
  typeSelect.addEventListener('change', () => {
    optionsContainer.style.display = typeSelect.value !== 'text' ? 'block' : 'none';
  });
}

function updateQuestionNumbers(container) {
  container.querySelectorAll('.question-item').forEach((item, idx) => {
    item.querySelector('.question-header span').textContent = 'Question ' + (idx + 1);
  });
}

function getQuestionsFromForm(containerId) {
  const container = document.getElementById(containerId);
  const questions = [];

  container.querySelectorAll('.question-item').forEach(item => {
    const text = item.querySelector('.question-text').value.trim();
    const type = item.querySelector('.question-type').value;
    const optionsText = item.querySelector('.question-options')?.value || '';

    if (text) {
      questions.push({
        text,
        type,
        options: type !== 'text' ? optionsText.split('\n').filter(o => o.trim()) : []
      });
    }
  });

  return questions;
}

async function handleCreateSurvey(e) {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const type = document.getElementById('type').value;
  const selectedDepartments = Array.from(document.querySelectorAll('input[name="assigned-departments"]:checked')).map(cb => cb.value);
  const selectedWorkstations = Array.from(document.querySelectorAll('input[name="assigned-workstations"]:checked')).map(cb => cb.value);

  try {
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        title,
        description,
        type,
        assigned_departments: selectedDepartments,
        assigned_workstations: selectedWorkstations,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (surveyError) throw surveyError;

    const questions = getQuestionsFromForm('questions-list');
    if (questions.length > 0) {
      const questionsData = questions.map((q, idx) => ({
        survey_id: survey.id,
        question_text: q.text,
        question_type: q.type,
        options: q.options,
        order_index: idx
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData);

      if (questionsError) throw questionsError;
    }

    e.target.reset();
    document.getElementById('questions-list').innerHTML = '';
    questionCount = 0;

    showNotification('Survey created successfully!', 'success');
    loadSurveys();
  } catch (error) {
    console.error('Error creating survey:', error);
    showNotification('Failed to create survey', 'error');
  }
}

async function loadSurveys() {
  try {
    const { data: surveys, error } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('surveys-list');

    if (!surveys || surveys.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No surveys yet. Create one above!</p></div>';
      return;
    }

    container.innerHTML = surveys.map(survey => `
      <div class="survey-card">
        <div class="survey-info">
          <h3>${escapeHtml(survey.title)}
            <span class="type-badge ${survey.type}">${survey.type}</span>
          </h3>
          <p class="survey-description">${escapeHtml(survey.description || 'No description')}</p>
          ${survey.assigned_departments?.length ? '<p class="survey-assigned"><small>Departments: ' + survey.assigned_departments.join(', ') + '</small></p>' : ''}
          ${survey.assigned_workstations?.length ? '<p class="survey-assigned"><small>Workstations: ' + survey.assigned_workstations.join(', ') + '</small></p>' : ''}
          <p class="survey-date"><small>Created: ${formatDateTime(survey.created_at)}</small></p>
        </div>
        <div class="survey-actions">
          <button class="btn btn-primary btn-small edit-survey-btn" data-id="${survey.id}">Edit</button>
          <button class="btn btn-secondary btn-small qrcode-btn">Get Link</button>
          <button class="btn btn-danger btn-small delete-survey-btn" data-id="${survey.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.edit-survey-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    container.querySelectorAll('.delete-survey-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteSurvey(btn.dataset.id));
    });

    container.querySelectorAll('.qrcode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('[data-tab="qrcode"]').click();
      });
    });
  } catch (error) {
    console.error('Error loading surveys:', error);
  }
}

async function deleteSurvey(surveyId) {
  if (!confirm('Are you sure you want to delete this survey? All responses will be deleted too.')) return;

  try {
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', surveyId);

    if (error) throw error;

    showNotification('Survey deleted', 'success');
    loadSurveys();
  } catch (error) {
    console.error('Error deleting survey:', error);
    showNotification('Failed to delete survey', 'error');
  }
}

async function openEditModal(surveyId) {
  try {
    const { data: survey, error } = await supabase
      .from('surveys')
      .select('*, questions(*)')
      .eq('id', surveyId)
      .single();

    if (error) throw error;

    document.getElementById('edit-id').value = survey.id;
    document.getElementById('edit-title').value = survey.title;
    document.getElementById('edit-description').value = survey.description || '';
    document.getElementById('edit-type').value = survey.type;

    const questionsList = document.getElementById('edit-questions-list');
    questionsList.innerHTML = '';
    editQuestionCount = 0;

    survey.questions.sort((a, b) => a.order_index - b.order_index).forEach(q => {
      addQuestion('edit-questions-list', q.question_text, q.question_type, q.options || []);
    });

    await loadDepartments();
    document.querySelectorAll('#edit-form input[name="assigned-departments"]').forEach(cb => {
      cb.checked = survey.assigned_departments?.includes(cb.value) || false;
    });

    await loadWorkstations();
    document.querySelectorAll('#edit-form input[name="assigned-workstations"]').forEach(cb => {
      cb.checked = survey.assigned_workstations?.includes(cb.value) || false;
    });

    document.getElementById('edit-modal').classList.add('active');
  } catch (error) {
    console.error('Error opening edit modal:', error);
  }
}

async function handleEditSurvey(e) {
  e.preventDefault();

  const surveyId = document.getElementById('edit-id').value;
  const title = document.getElementById('edit-title').value;
  const description = document.getElementById('edit-description').value;
  const type = document.getElementById('edit-type').value;
  const selectedDepartments = Array.from(document.querySelectorAll('#edit-form input[name="assigned-departments"]:checked')).map(cb => cb.value);
  const selectedWorkstations = Array.from(document.querySelectorAll('#edit-form input[name="assigned-workstations"]:checked')).map(cb => cb.value);

  try {
    const { error: surveyError } = await supabase
      .from('surveys')
      .update({
        title,
        description,
        type,
        assigned_departments: selectedDepartments,
        assigned_workstations: selectedWorkstations,
        updated_at: new Date().toISOString()
      })
      .eq('id', surveyId);

    if (surveyError) throw surveyError;

    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('survey_id', surveyId);

    if (existingQuestions && existingQuestions.length > 0) {
      await supabase
        .from('questions')
        .delete()
        .in('id', existingQuestions.map(q => q.id));
    }

    const questions = getQuestionsFromForm('edit-questions-list');
    if (questions.length > 0) {
      const questionsData = questions.map((q, idx) => ({
        survey_id: surveyId,
        question_text: q.text,
        question_type: q.type,
        options: q.options,
        order_index: idx
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData);

      if (questionsError) throw questionsError;
    }

    document.getElementById('edit-modal').classList.remove('active');
    showNotification('Survey updated successfully!', 'success');
    loadSurveys();
  } catch (error) {
    console.error('Error updating survey:', error);
    showNotification('Failed to update survey', 'error');
  }
}

async function loadDepartments() {
  try {
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error && error.code !== 'PGRST204') throw error;

    allDepartments = departments || [];

    const listContainer = document.getElementById('departments-list');
    if (listContainer) {
      if (allDepartments.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><p>No departments yet.</p></div>';
      } else {
        listContainer.innerHTML = allDepartments.map(d => `
          <div class="item-card">
            <div class="item-info">
              <h4>${escapeHtml(d.name)}</h4>
              <p><small>${d.description || 'No description'}</small></p>
            </div>
            <div class="item-actions">
              <button class="btn btn-danger btn-small delete-dept-btn" data-id="${d.id}">Delete</button>
            </div>
          </div>
        `).join('');

        listContainer.querySelectorAll('.delete-dept-btn').forEach(btn => {
          btn.addEventListener('click', () => deleteDepartment(btn.dataset.id));
        });
      }
    }

    updateAssignmentCheckboxes();

    const addDeptForm = document.getElementById('add-department-form');
    if (addDeptForm) {
      addDeptForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('dept-name').value.trim();
        const desc = document.getElementById('dept-description').value.trim();
        if (!name) return;

        const { error: deptError } = await supabase
          .from('departments')
          .insert({ name, description: desc });

        if (deptError) {
          showNotification('Failed to add department', 'error');
          return;
        }

        document.getElementById('dept-name').value = '';
        document.getElementById('dept-description').value = '';
        showNotification('Department added!', 'success');
        loadDepartments();
      };
    }
  } catch (error) {
    console.error('Error loading departments:', error);
    allDepartments = [];
    updateAssignmentCheckboxes();
  }
}

async function deleteDepartment(deptId) {
  if (!confirm('Delete this department?')) return;

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', deptId);

  if (error) {
    showNotification('Failed to delete department', 'error');
    return;
  }

  showNotification('Department deleted', 'success');
  loadDepartments();
}

async function loadWorkstations() {
  try {
    const { data: workstations, error } = await supabase
      .from('workstations')
      .select('*, departments(name)')
      .order('name', { ascending: true });

    if (error && error.code !== 'PGRST204') throw error;

    allWorkstations = workstations || [];

    const listContainer = document.getElementById('workstations-list');
    if (listContainer) {
      if (allWorkstations.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><p>No workstations yet.</p></div>';
      } else {
        listContainer.innerHTML = allWorkstations.map(w => `
          <div class="item-card">
            <div class="item-info">
              <h4>${escapeHtml(w.name)}</h4>
              <p><small>Department: ${w.departments?.name || 'Unassigned'}</small></p>
            </div>
            <div class="item-actions">
              <button class="btn btn-danger btn-small delete-ws-btn" data-id="${w.id}">Delete</button>
            </div>
          </div>
        `).join('');

        listContainer.querySelectorAll('.delete-ws-btn').forEach(btn => {
          btn.addEventListener('click', () => deleteWorkstation(btn.dataset.id));
        });
      }
    }

    updateAssignmentCheckboxes();

    const addWsForm = document.getElementById('add-workstation-form');
    if (addWsForm) {
      const deptSelect = document.getElementById('ws-department');
      if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Select Department</option>' +
          allDepartments.map(d => '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>').join('');
      }

      addWsForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('ws-name').value.trim();
        const deptId = document.getElementById('ws-department').value;
        if (!name) return;

        const { error: wsError } = await supabase
          .from('workstations')
          .insert({ name, department_id: deptId || null });

        if (wsError) {
          showNotification('Failed to add workstation', 'error');
          return;
        }

        document.getElementById('ws-name').value = '';
        document.getElementById('ws-department').value = '';
        showNotification('Workstation added!', 'success');
        loadWorkstations();
      };
    }
  } catch (error) {
    console.error('Error loading workstations:', error);
    allWorkstations = [];
    updateAssignmentCheckboxes();
  }
}

async function deleteWorkstation(wsId) {
  if (!confirm('Delete this workstation?')) return;

  const { error } = await supabase
    .from('workstations')
    .delete()
    .eq('id', wsId);

  if (error) {
    showNotification('Failed to delete workstation', 'error');
    return;
  }

  showNotification('Workstation deleted', 'success');
  loadWorkstations();
}

function updateAssignmentCheckboxes() {
  const deptContainer = document.getElementById('department-checkboxes');
  const wsContainer = document.getElementById('workstation-checkboxes');
  const editDeptContainer = document.getElementById('edit-department-checkboxes');
  const editWsContainer = document.getElementById('edit-workstation-checkboxes');

  const deptHtml = allDepartments.length > 0
    ? allDepartments.map(d => `
        <label class="checkbox-option">
          <input type="checkbox" name="assigned-departments" value="${escapeHtml(d.name)}" />
          ${escapeHtml(d.name)}
        </label>
      `).join('')
    : '<p class="empty-hint">No departments yet. Add them in the Departments tab.</p>';

  const wsHtml = allWorkstations.length > 0
    ? allWorkstations.map(w => `
        <label class="checkbox-option">
          <input type="checkbox" name="assigned-workstations" value="${escapeHtml(w.name)}" />
          ${escapeHtml(w.name)}
        </label>
      `).join('')
    : '<p class="empty-hint">No workstations yet. Add them in the Workstations tab.</p>';

  if (deptContainer) deptContainer.innerHTML = deptHtml;
  if (wsContainer) wsContainer.innerHTML = wsHtml;
  if (editDeptContainer) editDeptContainer.innerHTML = deptHtml;
  if (editWsContainer) editWsContainer.innerHTML = wsHtml;
}

function setupDocumentImport() {
  const importBtn = document.getElementById('import-questions-btn');
  const fileInput = document.getElementById('questions-file');

  if (!importBtn || !fileInput) return;

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      parseAndImportQuestions(content);
    };
    reader.readAsText(file);
    fileInput.value = '';
  });
}

function parseAndImportQuestions(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  let questionsAdded = 0;

  lines.forEach(line => {
    let questionText = line;
    questionText = questionText.replace(/^\d+[\.\)\:]\s*/, '');
    questionText = questionText.replace(/^[\-\*]\s*/, '');

    if (questionText) {
      addQuestion('questions-list', questionText, 'text', []);
      questionsAdded++;
    }
  });

  if (questionsAdded > 0) {
    showNotification('Imported ' + questionsAdded + ' questions!', 'success');
  } else {
    showNotification('No questions found in document', 'error');
  }
}

function setupFilters() {
  const searchInput = document.getElementById('search-responses');
  const monthFilter = document.getElementById('filter-month');
  const dateFilter = document.getElementById('filter-date');
  const clearBtn = document.getElementById('clear-filters');

  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterResponses, 300));
  }
  if (monthFilter) {
    monthFilter.addEventListener('change', filterResponses);
  }
  if (dateFilter) {
    dateFilter.addEventListener('change', filterResponses);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      monthFilter.value = '';
      dateFilter.value = '';
      filterResponses();
    });
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function filterResponses() {
  const search = document.getElementById('search-responses')?.value.toLowerCase() || '';
  const month = document.getElementById('filter-month')?.value || '';
  const date = document.getElementById('filter-date')?.value || '';

  let filtered = [...allResponsesData];

  if (search) {
    filtered = filtered.filter(r => {
      const name = (r.guest_name || '').toLowerCase();
      const surname = (r.surname || '').toLowerCase();
      const workstation = (r.workstation || '').toLowerCase();
      return name.includes(search) || surname.includes(search) || workstation.includes(search) || (name + ' ' + surname).includes(search);
    });
  }

  if (month) {
    filtered = filtered.filter(r => r.created_at.substring(0, 7) === month);
  }

  if (date) {
    filtered = filtered.filter(r => r.created_at.substring(0, 10) === date);
  }

  renderResponses(filtered);
}

function renderResponses(responses) {
  const container = document.getElementById('responses-list');

  if (!responses || responses.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No responses found.</p></div>';
    return;
  }

  const grouped = {};
  responses.forEach(r => {
    const rawDate = r.created_at.substring(0, 10);
    const date = formatDate(r.created_at);
    if (!grouped[rawDate]) grouped[rawDate] = { label: date, items: [] };
    grouped[rawDate].items.push(r);
  });

  container.innerHTML = Object.entries(grouped).map(([rawDate, group]) => `
    <div class="response-date-group">
      <h3>${group.label}
        <button class="btn btn-secondary btn-small download-date-btn" data-date="${rawDate}" data-label="${escapeHtml(group.label)}">Download PDF</button>
      </h3>
      <div class="responses-grid">
        ${group.items.map(r => `
          <div class="response-card" data-id="${r.id}">
            <div class="response-info">
              <h4>${escapeHtml(r.guest_name || '')} ${escapeHtml(r.surname || '')}</h4>
              <p class="workstation"><strong>Workstation:</strong> ${escapeHtml(r.workstation || 'Not specified')}</p>
              <p class="survey-title">${escapeHtml(r.surveys?.title || 'Unknown Survey')}</p>
              <p class="response-time"><small>Submitted: ${formatTime(r.created_at)}</small></p>
            </div>
            <button class="btn btn-primary btn-small view-response-btn" data-id="${r.id}" data-survey="${r.survey_id}">View Details</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.view-response-btn').forEach(btn => {
    btn.addEventListener('click', () => viewResponse(btn.dataset.id, btn.dataset.survey));
  });

  container.querySelectorAll('.download-date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.date;
      const dayResponses = allResponsesData.filter(r => r.created_at.substring(0, 10) === date);
      generatePdfReport(dayResponses, date);
    });
  });
}

async function loadResponses() {
  try {
    const { data: responses, error } = await supabase
      .from('responses')
      .select('id, guest_name, surname, workstation, created_at, survey_id, surveys(title, type)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allResponsesData = responses || [];
    filterResponses();
  } catch (error) {
    console.error('Error loading responses:', error);
  }
}

async function viewResponse(responseId, surveyId) {
  try {
    const { data: responseData, error: responseError } = await supabase
      .from('responses')
      .select('*, surveys(title, type)')
      .eq('id', responseId)
      .single();

    if (responseError) throw responseError;

    const { data: answers, error } = await supabase
      .from('answers')
      .select('answer_text, question_id, questions(question_text, question_type, order_index)')
      .eq('response_id', responseId);

    if (error) throw error;

    answers?.sort((a, b) => (a.questions?.order_index || 0) - (b.questions?.order_index || 0));

    const isChecklist = responseData.surveys?.type === 'checklist';

    const container = document.getElementById('response-details');
    container.innerHTML = `
      <div class="response-header-info">
        <div class="detail-block">
          <h4>Name</h4>
          <p>${escapeHtml(responseData.guest_name || '')} ${escapeHtml(responseData.surname || '')}</p>
        </div>
        <div class="detail-block">
          <h4>Workstation</h4>
          <p>${escapeHtml(responseData.workstation || 'Not specified')}</p>
        </div>
        <div class="detail-block">
          <h4>Survey</h4>
          <p>${escapeHtml(responseData.surveys?.title || 'Unknown')}</p>
        </div>
        <div class="detail-block">
          <h4>Submitted</h4>
          <p>${formatDateTime(responseData.created_at)}</p>
        </div>
      </div>
      ${responseData.signature ? '<div class="signature-display"><h4>Signature</h4><img src="' + responseData.signature + '" alt="Signature" class="signature-image" /></div>' : ''}
      <h3 style="margin-top: 1.5rem;">${isChecklist ? 'Checklist Items' : 'Answers'}</h3>
      ${answers.map((a, idx) => {
        if (isChecklist) {
          const isCompleted = a.answer_text === 'Completed';
          return '<div class="checklist-result-item ' + (isCompleted ? 'completed' : 'not-completed') + '"><span class="checklist-result-text">' + (idx + 1) + '. ' + escapeHtml(a.questions?.question_text || 'Unknown question') + '</span><input type="checkbox" ' + (isCompleted ? 'checked' : '') + ' disabled class="checklist-result-checkbox" /></div>';
        }
        return '<div class="detail-block"><h4>' + escapeHtml(a.questions?.question_text || 'Unknown question') + '</h4><p>' + escapeHtml(a.answer_text || 'No answer') + '</p></div>';
      }).join('') || '<p>No answers found.</p>'}
    `;

    document.getElementById('responses-modal').classList.add('active');
  } catch (error) {
    console.error('Error viewing response:', error);
  }
}

function generateQRCode() {
  const qrContainer = document.getElementById('qr-container');
  const guestUrl = document.getElementById('guest-url');

  const baseUrl = window.location.href.replace('index.html', '').replace(/\/$/, '');
  const guestLink = baseUrl + '/guest.html';

  const qr = qrcode(0, 'M');
  qr.addData(guestLink);
  qr.make();

  qrContainer.innerHTML = qr.createSvgTag(5, 0);
  guestUrl.textContent = guestLink;
}

function setupPdfDownload() {
  const btn = document.getElementById('download-pdf-btn');
  if (!btn) return;
  btn.addEventListener('click', generatePdfReport);
}

async function generatePdfReport(responsesOverride, dateLabelOverride) {
  const { jsPDF } = window.jspdf;

  const dateFilter = document.getElementById('pdf-date-filter')?.value || '';

  let filteredResponses;
  let dateLabel;
  if (responsesOverride) {
    filteredResponses = responsesOverride;
    dateLabel = dateLabelOverride || '';
  } else {
    filteredResponses = [...allResponsesData];
    if (dateFilter) {
      filteredResponses = allResponsesData.filter(r => r.created_at.substring(0, 10) === dateFilter);
    }
    dateLabel = dateFilter;
  }

  if (!filteredResponses || filteredResponses.length === 0) {
    showNotification('No responses to download for selected date', 'error');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('Survey Responses Report', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const dateText = (dateLabel || dateFilter) ? 'Date: ' + new Date(dateLabel || dateFilter).toLocaleDateString() : 'All Dates';
  doc.text(dateText + ' | Generated: ' + new Date().toLocaleString(), pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Total Responses: ' + filteredResponses.length, margin, y);
  y += 15;

  const groupedBySurvey = {};
  filteredResponses.forEach(r => {
    const surveyTitle = r.surveys?.title || 'Unknown Survey';
    const surveyType = r.surveys?.type || 'survey';
    if (!groupedBySurvey[surveyTitle]) {
      groupedBySurvey[surveyTitle] = { type: surveyType, responses: [] };
    }
    groupedBySurvey[surveyTitle].responses.push(r);
  });

  const responseIds = filteredResponses.map(r => r.id);
  const { data: allAnswers } = await supabase
    .from('answers')
    .select('answer_text, response_id, question_id, questions(question_text, order_index)')
    .in('response_id', responseIds);

  const answersByResponse = {};
  allAnswers?.forEach(a => {
    if (!answersByResponse[a.response_id]) {
      answersByResponse[a.response_id] = [];
    }
    answersByResponse[a.response_id].push(a);
  });

  for (const [surveyTitle, surveyData] of Object.entries(groupedBySurvey)) {
    const responses = surveyData.responses;
    const isChecklist = surveyData.type === 'checklist';

    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(surveyTitle + ' (' + surveyData.type + ')', margin + 3, y + 5.5);
    y += 12;

    const colWidths = [40, 40, 35, 30];
    const headers = ['First Name', 'Surname', 'Workstation', 'Time'];

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'S');

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);

    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, y + 5);
      xPos += colWidths[i];
    });
    y += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    for (const r of responses) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      const rowHeight = 7;
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, 'S');

      xPos = margin + 2;
      doc.setTextColor(30, 41, 59);

      doc.text(r.guest_name || '', xPos, y + 5);
      xPos += colWidths[0];

      doc.text(r.surname || '', xPos, y + 5);
      xPos += colWidths[1];

      doc.text(r.workstation || '', xPos, y + 5);
      xPos += colWidths[2];

      doc.text(new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), xPos, y + 5);

      y += rowHeight;
    }

    y += 10;

    if (isChecklist && responses.length > 0) {
      const firstAnswers = answersByResponse[responses[0].id] || [];
      const questions = firstAnswers.sort((a, b) => (a.questions?.order_index || 0) - (b.questions?.order_index || 0));

      if (questions.length > 0) {
        doc.setFillColor(16, 185, 129);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Checklist Items', margin + 3, y + 5);
        y += 10;

        doc.setFontSize(9);
        for (const qa of questions) {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          const qText = qa.questions?.question_text || 'Unknown';
          const qNum = qa.questions?.order_index !== undefined ? qa.questions.order_index + 1 : '?';

          const boxWidth = pageWidth - 2 * margin;
          doc.setDrawColor(203, 213, 225);
          doc.setFillColor(255, 255, 255);
          doc.rect(margin, y, boxWidth, 8, 'FD');

          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'bold');
          doc.text(String(qNum) + '.', margin + 3, y + 5.5);
          doc.setFont(undefined, 'normal');
          doc.text(qText.substring(0, 70) + (qText.length > 70 ? '...' : ''), margin + 15, y + 5.5);

          const checkboxX = margin + boxWidth - 15;
          doc.setDrawColor(100, 116, 139);
          doc.rect(checkboxX, y + 1.5, 5, 5, 'S');

          y += 10;
        }

        y += 5;
        doc.setFillColor(59, 130, 246);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Completion Status', margin + 3, y + 5);
        y += 10;

        const statusCols = [40, 40, 35, 35];
        const statusHeaders = ['First Name', 'Surname', 'Workstation', 'Completed'];

        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'S');

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);

        xPos = margin + 2;
        statusHeaders.forEach((header, i) => {
          doc.text(header, xPos, y + 5);
          xPos += statusCols[i];
        });
        y += 7;

        doc.setFont(undefined, 'normal');

        for (const r of responses) {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          const answers = answersByResponse[r.id] || [];
          const completedCount = answers.filter(a => a.answer_text === 'Completed').length;
          const totalCount = answers.length;
          const statusText = completedCount + '/' + totalCount;

          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, pageWidth - 2 * margin, 7, 'S');

          xPos = margin + 2;
          doc.setTextColor(30, 41, 59);

          doc.text(r.guest_name || '', xPos, y + 5);
          xPos += statusCols[0];

          doc.text(r.surname || '', xPos, y + 5);
          xPos += statusCols[1];

          doc.text(r.workstation || '', xPos, y + 5);
          xPos += statusCols[2];

          if (completedCount === totalCount) {
            doc.setTextColor(16, 185, 129);
          } else {
            doc.setTextColor(239, 68, 68);
          }
          doc.text(statusText, xPos, y + 5);

          y += 7;
        }
      }
    }

    y += 15;
  }

  const fileDate = dateLabel || dateFilter;
  const filename = fileDate ? 'survey-responses-' + fileDate + '.pdf' : 'survey-responses-' + new Date().toISOString().split('T')[0] + '.pdf';
  doc.save(filename);
  showNotification('PDF downloaded successfully!', 'success');
}

// Auth screen / main app toggling is handled by showAuthScreen() and
// showMainApp() defined near the top of the file, driven by onAuthStateChange.

function showNotification(message, type = 'info') {
  const bar = document.getElementById('notification-bar');
  if (!bar) return;

  bar.textContent = message;
  bar.className = 'notification-bar ' + type;
  bar.classList.add('show');

  setTimeout(() => {
    bar.classList.remove('show');
  }, 3000);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
