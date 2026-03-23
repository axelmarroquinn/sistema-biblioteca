// ── DATA LAYER ──────────────────────────────────────────────────────────────
const DB = {
  get libros()    { return JSON.parse(localStorage.getItem('bs_libros')    || '[]'); },
  get usuarios()  { return JSON.parse(localStorage.getItem('bs_usuarios')  || '[]'); },
  get prestamos() { return JSON.parse(localStorage.getItem('bs_prestamos') || '[]'); },
  set libros(v)    { localStorage.setItem('bs_libros',    JSON.stringify(v)); },
  set usuarios(v)  { localStorage.setItem('bs_usuarios',  JSON.stringify(v)); },
  set prestamos(v) { localStorage.setItem('bs_prestamos', JSON.stringify(v)); },
};

// ── UTILS ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'ok' ? '✓ ' : '✕ ') + msg;
  t.className = type === 'error' ? 'error' : '';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function diasRestantes(fechaLimite) {
  const hoyMs = new Date().setHours(0, 0, 0, 0);
  const limMs  = new Date(fechaLimite).setHours(0, 0, 0, 0);
  return Math.round((limMs - hoyMs) / 86400000);
}

function estadoPrestamo(p) {
  if (p.estado === 'Devuelto') return 'Devuelto';
  const dias = diasRestantes(p.fechaLimite);
  if (dias < 0) return 'Vencido';
  return 'Activo';
}

function badgeEstado(estado) {
  const map = {
    'Activo':   'badge-green',
    'Devuelto': 'badge-gray',
    'Vencido':  'badge-red',
  };
  return `<span class="badge ${map[estado] || 'badge-blue'}">${estado}</span>`;
}

function confirm2(msg) { return window.confirm(msg); }

function cerrarModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── NAVIGATION ──────────────────────────────────────────────────────────────
const TITLES = {
  dashboard: 'Dashboard',
  libros:    'Libros',
  usuarios:  'Usuarios',
  prestamos: 'Préstamos',
  reportes:  'Reportes',
};

function navigate(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + sec).classList.add('active');
  document.querySelectorAll('.nav-item')[
    ['dashboard', 'libros', 'usuarios', 'prestamos', 'reportes'].indexOf(sec)
  ].classList.add('active');
  document.getElementById('topbar-title').textContent = TITLES[sec];
  refreshAll();
}

// ── REFRESH ─────────────────────────────────────────────────────────────────
function refreshAll() {
  updateBadges();
  renderDashboard();
  renderTablaLibros();
  renderTablaUsuarios();
  renderTablaPrestamos();
  renderReportes();
  populateSelects();
}

function updateBadges() {
  document.getElementById('badge-libros').textContent   = DB.libros.length;
  document.getElementById('badge-usuarios').textContent = DB.usuarios.length;
  const activos = DB.prestamos.filter(p => estadoPrestamo(p) !== 'Devuelto').length;
  document.getElementById('badge-prestamos').textContent = activos;
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const libros    = DB.libros;
  const usuarios  = DB.usuarios;
  const prestamos = DB.prestamos;

  const activos  = prestamos.filter(p => estadoPrestamo(p) === 'Activo');
  const vencidos = prestamos.filter(p => estadoPrestamo(p) === 'Vencido');

  document.getElementById('stat-libros').textContent    = libros.length;
  document.getElementById('stat-usuarios').textContent  = usuarios.length;
  document.getElementById('stat-prestamos').textContent = activos.length;
  document.getElementById('stat-vencidos').textContent  = vencidos.length;

  // Alertas (activos con ≤3 días + vencidos)
  const alertas = prestamos.filter(p => {
    if (estadoPrestamo(p) === 'Devuelto') return false;
    return diasRestantes(p.fechaLimite) <= 3;
  });

  const tbA = document.getElementById('tbody-alertas');
  if (!alertas.length) {
    tbA.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">✅</div><p>Sin alertas activas</p></div></td></tr>`;
  } else {
    tbA.innerHTML = alertas.map(p => {
      const u   = DB.usuarios.find(x => x.id === p.usuarioId);
      const l   = DB.libros.find(x => x.id === p.libroId);
      const dias = diasRestantes(p.fechaLimite);
      const est  = estadoPrestamo(p);
      return `<tr>
        <td>${l ? l.titulo : '—'}</td>
        <td>${u ? u.nombre : '—'}</td>
        <td>${p.fechaLimite}</td>
        <td>
          ${badgeEstado(est)}
          ${est === 'Vencido'
            ? `<span style="color:var(--danger);font-size:11px;font-family:var(--font-mono)">${Math.abs(dias)}d vencido</span>`
            : `<span style="color:var(--muted);font-size:11px;font-family:var(--font-mono)">${dias}d restantes</span>`
          }
        </td>
      </tr>`;
    }).join('');
  }

  // Últimos 5 libros
  const ultimos = [...libros].reverse().slice(0, 5);
  const tbU = document.getElementById('tbody-ultimos');
  if (!ultimos.length) {
    tbU.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📚</div><p>Sin libros registrados</p></div></td></tr>`;
  } else {
    tbU.innerHTML = ultimos.map(l => {
      const disp = disponiblesLibro(l.id);
      return `<tr>
        <td><span style="font-family:var(--font-mono);font-size:12px">${l.codigo}</span></td>
        <td>${l.titulo}</td>
        <td>${l.autor}</td>
        <td><span class="badge badge-blue">${l.categoria}</span></td>
        <td>${disp > 0 ? `<span class="badge badge-green">${disp} disp.</span>` : `<span class="badge badge-red">Agotado</span>`}</td>
      </tr>`;
    }).join('');
  }
}

function disponiblesLibro(libroId) {
  const libro = DB.libros.find(l => l.id === libroId);
  if (!libro) return 0;
  const prestados = DB.prestamos.filter(
    p => p.libroId === libroId && estadoPrestamo(p) !== 'Devuelto'
  ).length;
  return Math.max(0, libro.cantidad - prestados);
}

// ── LIBROS ───────────────────────────────────────────────────────────────────
function registrarLibro() {
  const codigo    = document.getElementById('libro-codigo').value.trim();
  const titulo    = document.getElementById('libro-titulo').value.trim();
  const autor     = document.getElementById('libro-autor').value.trim();
  const categoria = document.getElementById('libro-categoria').value;
  const anio      = document.getElementById('libro-anio').value.trim();
  const cantidad  = parseInt(document.getElementById('libro-cantidad').value) || 1;

  if (!codigo || !titulo || !autor || !categoria) {
    toast('Completa los campos obligatorios (código, título, autor, categoría)', 'error');
    return;
  }
  const libros = DB.libros;
  if (libros.find(l => l.codigo === codigo)) {
    toast('Ya existe un libro con ese código', 'error');
    return;
  }
  libros.push({ id: uid(), codigo, titulo, autor, categoria, anio, cantidad, creadoEn: hoy() });
  DB.libros = libros;
  ['libro-codigo', 'libro-titulo', 'libro-autor', 'libro-anio'].forEach(
    id => document.getElementById(id).value = ''
  );
  document.getElementById('libro-categoria').value = '';
  document.getElementById('libro-cantidad').value  = '1';
  toast(`Libro "${titulo}" registrado correctamente`);
  refreshAll();
}

function renderTablaLibros() {
  const filtro = (document.getElementById('filtro-libros')?.value || '').toLowerCase();
  const cat    = document.getElementById('filtro-cat-libros')?.value || '';

  let libros = DB.libros.filter(l => {
    const match = !filtro ||
      l.titulo.toLowerCase().includes(filtro) ||
      l.autor.toLowerCase().includes(filtro)  ||
      l.codigo.toLowerCase().includes(filtro);
    const catOk = !cat || l.categoria === cat;
    return match && catOk;
  });

  const tb = document.getElementById('tbody-libros');
  if (!libros.length) {
    tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📚</div><p>Sin libros registrados</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = libros.map(l => {
    const disp = disponiblesLibro(l.id);
    return `<tr>
      <td><span style="font-family:var(--font-mono);font-size:12px">${l.codigo}</span></td>
      <td><strong>${l.titulo}</strong></td>
      <td>${l.autor}</td>
      <td><span class="badge badge-blue">${l.categoria}</span></td>
      <td>${l.anio || '—'}</td>
      <td>${disp > 0 ? `<span class="badge badge-green">${disp}</span>` : `<span class="badge badge-red">0</span>`}</td>
      <td>${l.cantidad}</td>
      <td class="td-actions">
        <button class="btn btn-secondary btn-sm" onclick="editarLibro('${l.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarLibro('${l.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function eliminarLibro(id) {
  const prestadoActivo = DB.prestamos.find(
    p => p.libroId === id && estadoPrestamo(p) !== 'Devuelto'
  );
  if (prestadoActivo) {
    toast('No se puede eliminar: el libro tiene préstamos activos', 'error');
    return;
  }
  if (!confirm2('¿Eliminar este libro?')) return;
  DB.libros = DB.libros.filter(l => l.id !== id);
  toast('Libro eliminado');
  refreshAll();
}

function editarLibro(id) {
  const l = DB.libros.find(x => x.id === id);
  if (!l) return;
  const nuevo = window.prompt('Nuevo título para el libro:', l.titulo);
  if (!nuevo || !nuevo.trim()) return;
  const libros = DB.libros;
  libros.find(x => x.id === id).titulo = nuevo.trim();
  DB.libros = libros;
  toast('Libro actualizado');
  refreshAll();
}

// ── USUARIOS ─────────────────────────────────────────────────────────────────
function registrarUsuario() {
  const carne   = document.getElementById('usuario-id').value.trim();
  const nombre  = document.getElementById('usuario-nombre').value.trim();
  const email   = document.getElementById('usuario-email').value.trim();
  const tipo    = document.getElementById('usuario-tipo').value;
  const carrera = document.getElementById('usuario-carrera').value.trim();
  const tel     = document.getElementById('usuario-telefono').value.trim();

  if (!carne || !nombre || !tipo) {
    toast('Completa los campos obligatorios (carné, nombre, tipo)', 'error');
    return;
  }
  const usuarios = DB.usuarios;
  if (usuarios.find(u => u.carne === carne)) {
    toast('Ya existe un usuario con ese carné/ID', 'error');
    return;
  }
  usuarios.push({ id: uid(), carne, nombre, email, tipo, carrera, telefono: tel, creadoEn: hoy() });
  DB.usuarios = usuarios;
  ['usuario-id', 'usuario-nombre', 'usuario-email', 'usuario-carrera', 'usuario-telefono'].forEach(
    id => document.getElementById(id).value = ''
  );
  document.getElementById('usuario-tipo').value = '';
  toast(`Usuario "${nombre}" registrado correctamente`);
  refreshAll();
}

function renderTablaUsuarios() {
  const filtro = (document.getElementById('filtro-usuarios')?.value || '').toLowerCase();
  let usuarios = DB.usuarios.filter(u =>
    !filtro ||
    u.nombre.toLowerCase().includes(filtro) ||
    u.carne.toLowerCase().includes(filtro)  ||
    (u.email || '').toLowerCase().includes(filtro)
  );

  const tb = document.getElementById('tbody-usuarios');
  if (!usuarios.length) {
    tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👤</div><p>Sin usuarios registrados</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = usuarios.map(u => {
    const prestActivos = DB.prestamos.filter(
      p => p.usuarioId === u.id && estadoPrestamo(p) !== 'Devuelto'
    ).length;
    return `<tr>
      <td><span style="font-family:var(--font-mono);font-size:12px">${u.carne}</span></td>
      <td><strong>${u.nombre}</strong></td>
      <td><span class="badge ${u.tipo === 'Estudiante' ? 'badge-blue' : u.tipo === 'Docente' ? 'badge-green' : 'badge-gray'}">${u.tipo}</span></td>
      <td>${u.carrera || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${u.telefono || '—'}</td>
      <td>${prestActivos > 0
        ? `<span class="badge badge-yellow">${prestActivos} activo${prestActivos > 1 ? 's' : ''}</span>`
        : '<span class="badge badge-gray">0</span>'
      }</td>
      <td class="td-actions">
        <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function eliminarUsuario(id) {
  const tieneActivos = DB.prestamos.find(
    p => p.usuarioId === id && estadoPrestamo(p) !== 'Devuelto'
  );
  if (tieneActivos) {
    toast('No se puede eliminar: el usuario tiene préstamos activos', 'error');
    return;
  }
  if (!confirm2('¿Eliminar este usuario?')) return;
  DB.usuarios = DB.usuarios.filter(u => u.id !== id);
  toast('Usuario eliminado');
  refreshAll();
}

// ── PRÉSTAMOS ────────────────────────────────────────────────────────────────
function populateSelects() {
  const selU = document.getElementById('prestamo-usuario');
  const selL = document.getElementById('prestamo-libro');
  if (!selU || !selL) return;

  const curU = selU.value;
  const curL = selL.value;

  selU.innerHTML = '<option value="">Seleccionar usuario...</option>' +
    DB.usuarios.map(u =>
      `<option value="${u.id}" ${u.id === curU ? 'selected' : ''}>${u.nombre} (${u.carne})</option>`
    ).join('');

  selL.innerHTML = '<option value="">Seleccionar libro disponible...</option>' +
    DB.libros
      .filter(l => disponiblesLibro(l.id) > 0)
      .map(l =>
        `<option value="${l.id}" ${l.id === curL ? 'selected' : ''}>${l.titulo} — ${disponiblesLibro(l.id)} disp.</option>`
      ).join('');

  // Fechas por defecto
  if (!document.getElementById('prestamo-fecha-inicio').value) {
    document.getElementById('prestamo-fecha-inicio').value = hoy();
    const limite = new Date();
    limite.setDate(limite.getDate() + 14);
    document.getElementById('prestamo-fecha-limite').value = limite.toISOString().split('T')[0];
  }
}

function registrarPrestamo() {
  const usuarioId   = document.getElementById('prestamo-usuario').value;
  const libroId     = document.getElementById('prestamo-libro').value;
  const fechaInicio = document.getElementById('prestamo-fecha-inicio').value;
  const fechaLimite = document.getElementById('prestamo-fecha-limite').value;
  const obs         = document.getElementById('prestamo-obs').value.trim();

  if (!usuarioId || !libroId || !fechaInicio || !fechaLimite) {
    toast('Completa todos los campos del préstamo', 'error');
    return;
  }
  if (fechaLimite <= fechaInicio) {
    toast('La fecha límite debe ser posterior a la fecha de préstamo', 'error');
    return;
  }
  if (disponiblesLibro(libroId) <= 0) {
    toast('No hay ejemplares disponibles de este libro', 'error');
    return;
  }

  const prestamos = DB.prestamos;
  const libro     = DB.libros.find(l => l.id === libroId);
  const usuario   = DB.usuarios.find(u => u.id === usuarioId);

  prestamos.push({
    id: uid(), usuarioId, libroId,
    fechaInicio, fechaLimite,
    observaciones: obs,
    estado: 'Activo',
    creadoEn: hoy(),
  });
  DB.prestamos = prestamos;

  document.getElementById('prestamo-usuario').value      = '';
  document.getElementById('prestamo-libro').value        = '';
  document.getElementById('prestamo-obs').value          = '';
  document.getElementById('prestamo-fecha-inicio').value = '';
  document.getElementById('prestamo-fecha-limite').value = '';

  toast(`Préstamo registrado: "${libro.titulo}" → ${usuario.nombre}`);
  refreshAll();
}

function renderTablaPrestamos() {
  const filtro    = (document.getElementById('filtro-prestamos')?.value || '').toLowerCase();
  const filtroEst = document.getElementById('filtro-estado-prestamo')?.value || '';

  let prestamos = DB.prestamos.map(p => ({ ...p, _estado: estadoPrestamo(p) }));

  if (filtroEst) prestamos = prestamos.filter(p => p._estado === filtroEst);
  if (filtro) {
    prestamos = prestamos.filter(p => {
      const u = DB.usuarios.find(x => x.id === p.usuarioId);
      const l = DB.libros.find(x => x.id === p.libroId);
      return (u?.nombre || '').toLowerCase().includes(filtro) ||
             (l?.titulo  || '').toLowerCase().includes(filtro);
    });
  }

  prestamos = [...prestamos].reverse();
  const tb = document.getElementById('tbody-prestamos');

  if (!prestamos.length) {
    tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🔖</div><p>Sin préstamos registrados</p></div></td></tr>`;
    return;
  }

  tb.innerHTML = prestamos.map(p => {
    const u   = DB.usuarios.find(x => x.id === p.usuarioId);
    const l   = DB.libros.find(x => x.id === p.libroId);
    const est = p._estado;
    const devBtn = est !== 'Devuelto'
      ? `<button class="btn btn-success btn-sm" onclick="devolverPrestamo('${p.id}')">↩ Devolver</button>`
      : '';
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">${p.id.slice(-4).toUpperCase()}</td>
      <td>${u ? u.nombre : '<span style="color:var(--danger)">—</span>'}</td>
      <td>${l ? l.titulo : '<span style="color:var(--danger)">—</span>'}</td>
      <td>${p.fechaInicio}</td>
      <td>${p.fechaLimite}</td>
      <td>${p.fechaDevolucion || '—'}</td>
      <td>${badgeEstado(est)}</td>
      <td class="td-actions">
        ${devBtn}
        <button class="btn btn-secondary btn-sm" onclick="verDetallePrestamo('${p.id}')">👁</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarPrestamo('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function devolverPrestamo(id) {
  const prestamos = DB.prestamos;
  const p = prestamos.find(x => x.id === id);
  if (!p) return;
  p.estado          = 'Devuelto';
  p.fechaDevolucion = hoy();
  DB.prestamos = prestamos;
  toast('Devolución registrada correctamente ✓');
  refreshAll();
}

function eliminarPrestamo(id) {
  if (!confirm2('¿Eliminar este registro de préstamo?')) return;
  DB.prestamos = DB.prestamos.filter(p => p.id !== id);
  toast('Préstamo eliminado');
  refreshAll();
}

function verDetallePrestamo(id) {
  const p = DB.prestamos.find(x => x.id === id);
  if (!p) return;
  const u   = DB.usuarios.find(x => x.id === p.usuarioId);
  const l   = DB.libros.find(x => x.id === p.libroId);
  const est = estadoPrestamo(p);

  document.getElementById('modal-detalle-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Usuario</label><p style="margin-top:4px">${u?.nombre || '—'}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Tipo</label><p style="margin-top:4px">${u?.tipo || '—'}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Libro</label><p style="margin-top:4px">${l?.titulo || '—'}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Autor</label><p style="margin-top:4px">${l?.autor || '—'}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Fecha préstamo</label><p style="margin-top:4px">${p.fechaInicio}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Fecha límite</label><p style="margin-top:4px">${p.fechaLimite}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Estado</label><p style="margin-top:4px">${badgeEstado(est)}</p></div>
      <div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Devolución</label><p style="margin-top:4px">${p.fechaDevolucion || 'Pendiente'}</p></div>
      ${p.observaciones
        ? `<div style="grid-column:1/-1"><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Observaciones</label><p style="margin-top:4px">${p.observaciones}</p></div>`
        : ''
      }
    </div>
  `;
  document.getElementById('modal-detalle').classList.add('open');
}

// ── REPORTES ─────────────────────────────────────────────────────────────────
function renderReportes() {
  const prestamos = DB.prestamos;
  const activos   = prestamos.filter(p => estadoPrestamo(p) === 'Activo').length;
  const devueltos = prestamos.filter(p => estadoPrestamo(p) === 'Devuelto').length;
  const vencidos  = prestamos.filter(p => estadoPrestamo(p) === 'Vencido').length;

  document.getElementById('rep-total-prestamos').textContent = prestamos.length;
  document.getElementById('rep-activos').textContent         = activos;
  document.getElementById('rep-devueltos').textContent       = devueltos;
  document.getElementById('rep-vencidos').textContent        = vencidos;

  // Top libros
  const cntLibros = {};
  prestamos.forEach(p => { cntLibros[p.libroId] = (cntLibros[p.libroId] || 0) + 1; });
  const topLibros = Object.entries(cntLibros).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tbTL = document.getElementById('tbody-top-libros');
  tbTL.innerHTML = topLibros.length
    ? topLibros.map(([id, cnt]) => {
        const l = DB.libros.find(x => x.id === id);
        return `<tr><td>${l ? l.titulo : '—'}</td><td><span class="badge badge-green">${cnt}</span></td></tr>`;
      }).join('')
    : `<tr><td colspan="2"><div class="empty-state" style="padding:20px"><p>Sin datos</p></div></td></tr>`;

  // Top usuarios
  const cntUsuarios = {};
  prestamos.forEach(p => { cntUsuarios[p.usuarioId] = (cntUsuarios[p.usuarioId] || 0) + 1; });
  const topUsuarios = Object.entries(cntUsuarios).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tbTU = document.getElementById('tbody-top-usuarios');
  tbTU.innerHTML = topUsuarios.length
    ? topUsuarios.map(([id, cnt]) => {
        const u = DB.usuarios.find(x => x.id === id);
        return `<tr>
          <td>${u ? u.nombre : '—'}</td>
          <td>${u ? `<span class="badge badge-blue">${u.tipo}</span>` : '—'}</td>
          <td><span class="badge badge-green">${cnt}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3"><div class="empty-state" style="padding:20px"><p>Sin datos</p></div></td></tr>`;

  // Sin stock
  const sinStock = DB.libros.filter(l => disponiblesLibro(l.id) === 0);
  const tbSS = document.getElementById('tbody-sin-stock');
  tbSS.innerHTML = sinStock.length
    ? sinStock.map(l =>
        `<tr>
          <td><span style="font-family:var(--font-mono);font-size:12px">${l.codigo}</span></td>
          <td>${l.titulo}</td>
          <td>${l.autor}</td>
          <td>${l.cantidad}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="4"><div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><p>Todos los libros tienen disponibilidad</p></div></td></tr>`;
}

// ── BÚSQUEDA GLOBAL ──────────────────────────────────────────────────────────
function globalSearch(q) {
  if (!q.trim()) return;
  const ql = q.toLowerCase();
  const libro = DB.libros.find(l =>
    l.titulo.toLowerCase().includes(ql) ||
    l.autor.toLowerCase().includes(ql)  ||
    l.codigo.toLowerCase().includes(ql)
  );
  const usuario = DB.usuarios.find(u =>
    u.nombre.toLowerCase().includes(ql) ||
    u.carne.toLowerCase().includes(ql)
  );
  if (libro) {
    navigate('libros');
    document.getElementById('filtro-libros').value = q;
    renderTablaLibros();
  } else if (usuario) {
    navigate('usuarios');
    document.getElementById('filtro-usuarios').value = q;
    renderTablaUsuarios();
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
function exportarCSV() {
  const rows = [['ID', 'Usuario', 'Libro', 'Fecha Préstamo', 'Fecha Límite', 'Devolución', 'Estado']];
  DB.prestamos.forEach(p => {
    const u = DB.usuarios.find(x => x.id === p.usuarioId);
    const l = DB.libros.find(x => x.id === p.libroId);
    rows.push([
      p.id,
      u?.nombre || '—',
      l?.titulo  || '—',
      p.fechaInicio,
      p.fechaLimite,
      p.fechaDevolucion || '',
      estadoPrestamo(p),
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'prestamos_' + hoy() + '.csv';
  a.click();
  toast('CSV exportado correctamente');
}

function limpiarDatos() {
  if (!confirm2('¿Estás seguro? Esto eliminará TODOS los datos del sistema.')) return;
  localStorage.removeItem('bs_libros');
  localStorage.removeItem('bs_usuarios');
  localStorage.removeItem('bs_prestamos');
  toast('Todos los datos eliminados');
  refreshAll();
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  refreshAll();
});

document.getElementById('modal-detalle').addEventListener('click', function (e) {
  if (e.target === this) cerrarModal('modal-detalle');
});
