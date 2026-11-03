
    const state = { user: null, orders: [], clientFilter: 'todos', managerFilter: 'todos' };
    const ORDER_REFRESH_MS = 10000;
    const API_ORIGINS = [
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://127.0.0.1:8000',
      'http://localhost:8000',
      'http://127.0.0.1:3000',
      'http://localhost:3000'
    ];

    function buildSameHostCandidates() {
      const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
      const hostname = window.location.hostname || '127.0.0.1';
      const port = window.location.port;
      const candidates = new Set();
      const protocols = [protocol];

      if (protocol === 'https:') {
        protocols.push('http:');
      } else if (protocol === 'http:') {
        protocols.push('https:');
      }

      protocols.forEach(candidateProtocol => {
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
          candidates.add(`${candidateProtocol}//${hostname}:5000`);
          candidates.add(`${candidateProtocol}//${hostname}:8000`);
          candidates.add(`${candidateProtocol}//${hostname}:3000`);
        }

        if (hostname && port) {
          candidates.add(`${candidateProtocol}//${hostname}:${port}`);
        }
      });

      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        ['http://127.0.0.1:5000', 'http://localhost:5000', 'http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://localhost:3000', 'https://127.0.0.1:5000', 'https://localhost:5000'].forEach(candidate => candidates.add(candidate));
      }

      return Array.from(candidates);
    }

    const preferredApiBase = (() => {
      const fromGlobal = window.NIVELTECH_API_BASE_URL || window.__API_BASE_URL__;
      if (fromGlobal) return String(fromGlobal).replace(/\/$/, '');

      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('api');
      if (fromQuery) return String(fromQuery).replace(/\/$/, '');

      const fromStorage = localStorage.getItem('niveltech_api_base_url');
      if (fromStorage) return String(fromStorage).replace(/\/$/, '');

      return null;
    })();

    let apiBaseUrl = (() => {
      const currentOrigin = window.location.origin;
      if (preferredApiBase) return preferredApiBase;
      if (!currentOrigin || currentOrigin === 'null' || currentOrigin.startsWith('file://')) {
        return API_ORIGINS[0];
      }
      return currentOrigin;
    })();

    let apiBaseUrlPromise = null;
    let localBackendStartupAttempted = false;

    function tryStartLocalBackend() {
      if (localBackendStartupAttempted) return false;
      localBackendStartupAttempted = true;

      const fallbackUrl = 'http://127.0.0.1:5000';
      setApiStatus('<strong>Iniciando o backend automaticamente...</strong>');

      apiBaseUrl = fallbackUrl;
      localStorage.setItem('niveltech_api_base_url', fallbackUrl);
      return true;
    }

    function normalizeApiBase(value) {
      if (!value) return '';
      let normalized = String(value).trim();
      if (!normalized) return '';
      normalized = normalized.replace(/\/+$/, '');

      if (/^https?:\/\//i.test(normalized)) {
        return normalized;
      }

      const host = normalized.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.');

      if (isLocalHost || /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(host)) {
        return `http://${normalized}`;
      }

      return `https://${normalized}`;
    }

    function setApiStatus(message) {
      const statusNode = document.getElementById('apiStatus');
      if (!statusNode) return;
      statusNode.innerHTML = message;
    }

    async function detectApiBaseUrl() {
      if (apiBaseUrlPromise) {
        return apiBaseUrlPromise;
      }

      apiBaseUrlPromise = (async () => {
        const explicitBase = normalizeApiBase(preferredApiBase || apiBaseUrl || localStorage.getItem('niveltech_api_base_url'));
        if (explicitBase) {
          apiBaseUrl = explicitBase;
          localStorage.setItem('niveltech_api_base_url', explicitBase);
          return explicitBase;
        }

        const candidates = Array.from(new Set([
          apiBaseUrl,
          ...buildSameHostCandidates(),
          ...API_ORIGINS
        ]));

        for (const candidate of candidates) {
          try {
            const response = await fetch(`${candidate}/health`, { method: 'GET', mode: 'cors' });
            if (response.ok) {
              apiBaseUrl = candidate;
              localStorage.setItem('niveltech_api_base_url', candidate);
              return candidate;
            }
          } catch (error) {
            // a origem atual pode não ser o servidor da API; tenta a próxima alternativa.
          }
        }

        if (preferredApiBase) {
          apiBaseUrl = preferredApiBase;
        }

        if (!apiBaseUrl || apiBaseUrl.startsWith('file://')) {
          tryStartLocalBackend();
        }

        return apiBaseUrl;
      })();

      return apiBaseUrlPromise;
    }

    function resolveApiUrl(path) {
      if (/^https?:\/\//i.test(path)) {
        return path;
      }
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${apiBaseUrl}${normalizedPath}`;
    }

    async function api(path, options = {}) {
      const baseUrl = await detectApiBaseUrl();
      const requestHeaders = {
        Accept: 'application/json',
        ...(options.headers || {})
      };
      if (options.body && !Object.prototype.hasOwnProperty.call(requestHeaders, 'Content-Type')) {
        requestHeaders['Content-Type'] = 'application/json';
      }

      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${baseUrl}${normalizedPath}`;

      if (baseUrl && /^https?:\/\//i.test(baseUrl)) {
        setApiStatus(`Conexão atual: <strong>${baseUrl}</strong>`);
      }

      let response;
      try {
        response = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: requestHeaders
        });
      } catch (error) {
        throw new Error('O servidor da aplicação não está disponível. Inicie o backend e tente novamente.');
      }

      const text = await response.text();
      let payload = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (error) {
          payload = { error: text.trim() || 'Erro ao processar a requisição.' };
        }
      }

      if (!response.ok) {
        const message = payload.error || payload.message || `Erro ao processar a requisição (${response.status}).`;
        if (response.status === 404) {
          throw new Error('API não encontrada. Inicie o backend em http://127.0.0.1:5000, use o mesmo host do servidor ou passe ?api=http://IP_DO_SERVIDOR:5000 na URL da página.');
        }
        if (response.status === 405) {
          throw new Error('Método não permitido pela API. Verifique se a URL da API e o backend estão corretos e se o endpoint aceita a requisição atual.');
        }
        throw new Error(message);
      }

      return payload;
    }

    function readableError(error) {
      const message = (error && error.message ? error.message : '').trim();
      if (!message) return 'Não foi possível concluir a operação. Tente novamente.';
      if (message.includes('E-mail ou senha inválidos')) return 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.';
      if (message.includes('Este e-mail já está cadastrado')) return 'Este e-mail já está cadastrado. Faça login ou use outro endereço.';
      if (message.includes('Nome, e-mail e senha')) return 'Preencha nome, e-mail e senha com pelo menos 6 caracteres.';
      if (message.includes('Informe e-mail e senha')) return 'Informe seu e-mail e senha para continuar.';
      return message;
    }

    function showView(name) {
      const home = document.getElementById('homeView');
      const dashboard = document.getElementById('dashboardView');
      home.classList.toggle('hidden', name !== 'home');
      dashboard.classList.toggle('hidden', name !== 'dashboard');
    }

    function setAuthTab(tabName) {
      document.querySelectorAll('.auth-tab').forEach(button => {
        const isActive = button.dataset.authTab === tabName;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
      });

      document.querySelectorAll('.auth-panel').forEach(panel => {
        const isActive = panel.dataset.authPanel === tabName;
        panel.classList.toggle('active', isActive);
      });
    }

    function setLogoutVisible(visible) {
      document.getElementById('logoutBtn').classList.toggle('hidden', !visible);
    }

    function formatDate(value) {
      if (!value) return '—';
      const date = new Date(value + 'T12:00:00');
      return isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
    }

    function formatCurrency(value) {
      return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function statusClass(status) {
      const map = {
        Pendente: 'pendente',
        'Em andamento': 'em-andamento',
        Concluído: 'concluido',
        Inacabado: 'inacabado'
      };
      return map[status] || 'pendente';
    }

    function renderMessages(messages = []) {
      if (!messages.length) {
        return '<div class="tiny">Ainda não há mensagens.</div>';
      }
      return messages.map(msg => `
        <div class="message ${msg.sender}">
          <strong>${msg.sender_name || 'Sistema'}</strong>
          <div>${msg.text}</div>
          <div class="tiny">${formatDate(msg.created_at.split('T')[0])}</div>
        </div>
      `).join('');
    }

    function getFilteredOrders(role) {
      const filter = role === 'manager' ? state.managerFilter : state.clientFilter;
      const orders = [...(state.orders || [])];
      if (filter === 'todos') return orders;
      return orders.filter(order => order.status === filter);
    }

    function renderDashboardSummary() {
      const summaryRoot = document.getElementById('dashboardSummary');
      if (!summaryRoot) return;

      const orders = state.orders || [];
      const total = orders.length;
      const pending = orders.filter(order => order.status === 'Pendente').length;
      const inProgress = orders.filter(order => order.status === 'Em andamento').length;
      const completed = orders.filter(order => order.status === 'Concluído').length;
      const revenue = orders.reduce((sum, order) => sum + Number(order.price || 0), 0);

      const cards = state.user?.role === 'manager'
        ? [
            { label: 'Pedidos', value: total },
            { label: 'Pendentes', value: pending },
            { label: 'Em andamento', value: inProgress },
            { label: 'Faturamento', value: formatCurrency(revenue) }
          ]
        : [
            { label: 'Meus pedidos', value: total },
            { label: 'Pendentes', value: pending },
            { label: 'Concluídos', value: completed },
            { label: 'Projetos', value: total }
          ];

      document.getElementById('summaryGrid').innerHTML = cards.map(card => `
        <div class="summary-card">
          <span class="tiny">${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `).join('');

      summaryRoot.classList.toggle('hidden', !state.user);
    }

    function renderClientOrders(orders) {
      const root = document.getElementById('clientOrders');
      const filtered = getFilteredOrders('client');
      if (!filtered.length) {
        root.innerHTML = '<div class="panel"><h3>Seu primeiro pedido</h3><p class="tiny">Você ainda não enviou nenhum projeto nesta categoria.</p></div>';
        return;
      }

      root.innerHTML = filtered.map(order => `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="tiny">${order.id}</div>
              <h3 class="order-title">${order.company}</h3>
            </div>
            <span class="status ${statusClass(order.status)}">${order.status}</span>
          </div>
          <div class="meta">
            <span>Tipo: ${order.type}</span>
            <span>Prazo: ${formatDate(order.deadline)}</span>
            <span>Valor: ${formatCurrency(order.price)}</span>
          </div>
          ${order.manager_note ? `<div class="notice">${order.manager_note}</div>` : ''}
          <div class="msg-box">
            <div class="tiny">Conversa</div>
            <div class="messages">${renderMessages(order.messages || [])}</div>
          </div>
          <form class="message-form" data-order-id="${order.id}" style="margin-top: 12px;">
            <input name="text" placeholder="Escreva uma mensagem para o gerente..." required />
            <button class="btn primary" type="submit">Enviar</button>
          </form>
        </div>
      `).join('');

      document.querySelectorAll('.message-form').forEach(form => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const text = (fd.get('text') || '').toString().trim();
          if (!text) return;
          try {
            await api(`/api/orders/${form.dataset.orderId}/message`, {
              method: 'POST',
              body: JSON.stringify({ text })
            });
            await loadOrders();
          } catch (error) {
            alert(readableError(error));
          }
        });
      });
    }

    function renderManagerOrders(orders) {
      const root = document.getElementById('managerOrders');
      const filtered = getFilteredOrders('manager');
      if (!filtered.length) {
        root.innerHTML = '<div class="panel"><h3>Nenhum pedido</h3><p class="tiny">Ainda não existem pedidos cadastrados nesta categoria.</p></div>';
        return;
      }

      root.innerHTML = filtered.map(order => `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="tiny">${order.id}</div>
              <h3 class="order-title">${order.company}</h3>
            </div>
            <span class="status ${statusClass(order.status)}">${order.status}</span>
          </div>
          <div class="meta">
            <span>Cliente: ${order.client_name || order.client_email || 'Cliente'}</span>
            <span>Contato: ${order.client_email || '—'}</span>
            <span>Prazo: ${formatDate(order.deadline)}</span>
          </div>
          <div class="meta">
            <span>Valor: ${formatCurrency(order.price)}</span>
            <span>Recebido: ${formatCurrency(order.received || 0)}</span>
          </div>
          <div class="manager-actions">
            <div class="inline-editor">
              <label>
                Status
                <select data-role="status-select" data-id="${order.id}">
                  <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                  <option value="Em andamento" ${order.status === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
                  <option value="Concluído" ${order.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                  <option value="Inacabado" ${order.status === 'Inacabado' ? 'selected' : ''}>Inacabado</option>
                </select>
              </label>
              <label>
                Prazo
                <input type="date" data-role="deadline-input" data-id="${order.id}" value="${order.deadline ? String(order.deadline).slice(0, 10) : ''}" />
              </label>
              <label>
                Valor
                <input type="number" step="0.01" data-role="price-input" data-id="${order.id}" value="${Number(order.price || 0).toFixed(2)}" placeholder="0,00" />
              </label>
              <button class="btn" type="button" data-action="status" data-id="${order.id}">Salvar</button>
            </div>
            <div class="inline-editor">
              <label>
                Pagamento
                <input type="number" step="0.01" data-role="payment-input" data-id="${order.id}" placeholder="Valor" />
              </label>
              <label>
                Obs.
                <input type="text" data-role="payment-note" data-id="${order.id}" placeholder="Opcional" />
              </label>
              <button class="btn primary" type="button" data-action="payment" data-id="${order.id}">Registrar</button>
            </div>
          </div>
          ${order.manager_note ? `<div class="notice">${order.manager_note}</div>` : ''}
          <div class="msg-box">
            <div class="tiny">Conversa</div>
            <div class="messages">${renderMessages(order.messages || [])}</div>
          </div>
          <form class="message-form" data-order-id="${order.id}" style="margin-top: 12px;">
            <input name="text" placeholder="Responder ao cliente..." required />
            <button class="btn primary" type="submit">Enviar</button>
          </form>
        </div>
      `).join('');

      document.querySelectorAll('[data-action="status"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const orderId = btn.dataset.id;
          const select = document.querySelector(`[data-role="status-select"][data-id="${orderId}"]`);
          const deadlineInput = document.querySelector(`[data-role="deadline-input"][data-id="${orderId}"]`);
          const priceInput = document.querySelector(`[data-role="price-input"][data-id="${orderId}"]`);
          const status = (select?.value || '').trim();
          const deadline = deadlineInput && deadlineInput.value ? deadlineInput.value : undefined;
          const price = priceInput && priceInput.value !== '' ? Number(priceInput.value) : undefined;
          if (!status) return;
          try {
            await api(`/api/orders/${orderId}/status`, {
              method: 'POST',
              body: JSON.stringify({
                status,
                deadline,
                price: price !== undefined && !Number.isNaN(price) ? price : undefined,
                manager_note: `Status atualizado para ${status} pelo gerente.`
              })
            });
            await loadOrders();
          } catch (error) {
            alert(readableError(error));
          }
        });
      });

      document.querySelectorAll('[data-action="payment"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const orderId = btn.dataset.id;
          const amountInput = document.querySelector(`[data-role="payment-input"][data-id="${orderId}"]`);
          const noteInput = document.querySelector(`[data-role="payment-note"][data-id="${orderId}"]`);
          const amount = amountInput ? Number(amountInput.value) : NaN;
          if (!amountInput || !amountInput.value || Number.isNaN(amount) || amount <= 0) {
            alert('Informe um valor do pagamento válido.');
            return;
          }
          try {
            await api(`/api/orders/${orderId}/payment`, {
              method: 'POST',
              body: JSON.stringify({ amount, note: noteInput ? noteInput.value : '' })
            });
            await loadOrders();
          } catch (error) {
            alert(readableError(error));
          }
        });
      });

      document.querySelectorAll('.message-form').forEach(form => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const text = (fd.get('text') || '').toString().trim();
          if (!text) return;
          try {
            await api(`/api/orders/${form.dataset.orderId}/message`, {
              method: 'POST',
              body: JSON.stringify({ text })
            });
            await loadOrders();
          } catch (error) {
            alert(readableError(error));
          }
        });
      });
    }

    async function loadOrders() {
      try {
        const data = await api('/api/orders');
        state.orders = data.orders || [];
        renderDashboardSummary();
        if (state.user?.role === 'manager') {
          renderManagerOrders(state.orders);
        } else {
          renderClientOrders(state.orders);
        }
      } catch (error) {
        console.error(error);
      }
    }

    function renderDashboard() {
      if (!state.user) {
        showView('home');
        setLogoutVisible(false);
        return;
      }

      showView('dashboard');
      setLogoutVisible(true);
      document.getElementById('welcomeLabel').textContent = state.user.role === 'manager' ? 'Painel do gerente' : `Olá, ${state.user.name.split(' ')[0]}!`;

      document.getElementById('clientSection').classList.toggle('hidden', state.user.role !== 'client');
      document.getElementById('managerSection').classList.toggle('hidden', state.user.role !== 'manager');
      renderDashboardSummary();

      if (state.user.role === 'client') {
        renderClientOrders([]);
      }
      if (state.user.role === 'manager') {
        renderManagerOrders([]);
      }
      loadOrders();
    }

    async function loadSession() {
      try {
        const data = await api('/api/session');
        state.user = data.user || null;
        renderDashboard();
      } catch (error) {
        console.error(error);
        showView('home');
      }
    }

    document.getElementById('apiConfigForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const value = normalizeApiBase(form.get('apiUrl'));

      if (!value) {
        setApiStatus('<strong>Informe a URL da API para continuar.</strong>');
        return;
      }

      apiBaseUrl = value;
      apiBaseUrlPromise = null;
      localStorage.setItem('niveltech_api_base_url', value);
      setApiStatus(`Conexão atual: <strong>${value}</strong>`);

      try {
        await detectApiBaseUrl();
        if (state.user) {
          await loadSession();
        }
      } catch (error) {
        setApiStatus(`Conexão atual: <strong>${value}</strong> (a API pode estar indisponível no momento)`);
      }
    });

    document.getElementById('detectApiBtn').addEventListener('click', async () => {
      try {
        const detected = await detectApiBaseUrl();
        setApiStatus(`Conexão atual: <strong>${detected}</strong>`);
        document.getElementById('apiUrlInput').value = detected;
      } catch (error) {
        setApiStatus('<strong>Não foi possível detectar a API automaticamente.</strong> Informe a URL manualmente.');
      }
    });

    (async () => {
      try {
        const detected = await detectApiBaseUrl();
        setApiStatus(`Conexão atual: <strong>${detected}</strong>`);
        if (document.getElementById('apiUrlInput')) {
          document.getElementById('apiUrlInput').value = detected;
        }
      } catch (error) {
        setApiStatus('<strong>Não foi possível detectar a API automaticamente.</strong>');
      }
    })();

    document.getElementById('registerForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const payload = {
          name: String(form.get('name') || '').trim(),
          email: String(form.get('email') || '').trim(),
          phone: String(form.get('phone') || '').trim(),
          password: String(form.get('password') || '').trim()
        };
        const data = await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
        state.user = data.user;
        renderDashboard();
        event.target.reset();
      } catch (error) {
        alert(readableError(error));
      }
    });

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const payload = {
          email: String(form.get('email') || '').trim(),
          password: String(form.get('password') || '').trim()
        };
        const data = await api('/api/login', { method: 'POST', body: JSON.stringify(payload) });
        if (data.user && data.user.role !== 'client') {
          throw new Error('Este acesso é reservado para clientes. Use o painel administrativo do gerente.');
        }
        state.user = data.user;
        renderDashboard();
        event.target.reset();
      } catch (error) {
        alert(readableError(error));
      }
    });

    document.getElementById('managerLoginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const payload = {
          email: String(form.get('email') || '').trim(),
          password: String(form.get('password') || '').trim()
        };
        const data = await api('/api/login', { method: 'POST', body: JSON.stringify(payload) });
        if (data.user && data.user.role !== 'manager') {
          throw new Error('Este login não pertence a um gerente autorizado.');
        }
        state.user = data.user;
        renderDashboard();
        event.target.reset();
      } catch (error) {
        alert(readableError(error));
      }
    });

    document.querySelectorAll('.auth-tab').forEach(button => {
      button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
      button.addEventListener('click', () => {
        const { role, filter } = button.dataset;
        if (role === 'client') {
          state.clientFilter = filter;
        } else {
          state.managerFilter = filter;
        }

        document.querySelectorAll(`.filter-btn[data-role="${role}"]`).forEach(btn => {
          btn.classList.toggle('active', btn === button);
        });

        renderDashboardSummary();
        if (state.user?.role === 'manager') {
          renderManagerOrders(state.orders);
        } else if (state.user?.role === 'client') {
          renderClientOrders(state.orders);
        }
      });
    });

    document.getElementById('orderForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const payload = {
          company: String(form.get('company') || '').trim(),
          type: String(form.get('type') || '').trim(),
          description: String(form.get('description') || '').trim(),
          reference: String(form.get('reference') || '').trim(),
          startDate: String(form.get('startDate') || '').trim()
        };
        await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
        event.target.reset();
        await loadOrders();
      } catch (error) {
        alert(readableError(error));
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await api('/api/logout', { method: 'POST' });
        state.user = null;
        renderDashboard();
      } catch (error) {
        console.error(error);
      }
    });

    setInterval(() => {
      if (state.user?.role === 'manager') {
        loadOrders().catch(() => {});
      }
    }, ORDER_REFRESH_MS);

    const apiUrlInput = document.getElementById('apiUrlInput');
    if (apiUrlInput) {
      apiUrlInput.value = apiBaseUrl || '';
      if (apiBaseUrl) {
        setApiStatus(`Conexão atual: <strong>${apiBaseUrl}</strong>`);
      }
    }

    loadSession();
  
