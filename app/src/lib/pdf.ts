import type { Champ, Formulaire, Valeurs } from '../forms/types';
import type { Site } from './auth';

// Fiches en PDF, générées sur l'appareil (fonctionne sans internet).
// Les polices standard du PDF ne couvrent pas tous les caractères : on les remplace proprement.
const propre = (t: unknown) => String(t ?? '')
  .replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/✓\s?/g, '').replace(/\u202f/g, ' ');

const dateFr = (d: unknown) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

function valeurChamp(c: Champ, v: unknown, sites: Site[]): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '-';
  switch (c.type) {
    case 'choix': return c.options.find((o) => o.v === v)?.l ?? String(v);
    case 'multi': return (v as string[]).map((x) => c.options.find((o) => o.v === x)?.l ?? x).join(' ; ');
    case 'ouinon': return v === true ? 'Oui' : 'Non';
    case 'ouinonnsp': return ({ oui: 'Oui', non: 'Non', nsp: 'Ne sait pas' } as Record<string, string>)[String(v)] ?? String(v);
    case 'site': return sites.find((s) => s.id === Number(v))?.nom ?? String(v);
    case 'date': return dateFr(v);
    default: return String(v);
  }
}

function caseVierge(c: Champ, sites: Site[]): string {
  const cases = (l: string[]) => l.map((x) => `[  ] ${x}`).join('     ');
  switch (c.type) {
    case 'choix': case 'multi': return cases(c.options.map((o) => o.l));
    case 'ouinon': return cases(['Oui', 'Non']);
    case 'ouinonnsp': return cases(['Oui', 'Non', 'Ne sait pas']);
    case 'site': return cases(sites.map((s) => s.nom));
    case 'date': return '____ / ____ / 2026';
    case 'time': return '____ h ____';
    default: return '';
  }
}

type Options = {
  form: Formulaire;
  valeurs: Valeurs | null;          // null = fiche vierge
  sites: Site[];
  titre: string;
  code?: string;                    // code bénéficiaire, n° de référence…
  enTete?: [string, string][];      // lignes ajoutées en haut (patiente d'une référence…)
  confidentiel?: boolean;
  nomFichier: string;
};

export async function telechargerFichePdf(o: Options) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = doc.internal.pageSize.getWidth();
  const ROSE: [number, number, number] = [156, 20, 80];
  const ROSE_PALE: [number, number, number] = [253, 231, 239];
  const vierge = o.valeurs === null;
  const v = o.valeurs ?? {};

  // En-tête
  doc.setFillColor(...ROSE);
  doc.rect(0, 0, L, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'normal'); doc.setFontSize(9);
  doc.text('CAMPAGNE OCTOBRE ROSE 2026 - ASSOCIATION DÉVELOPPEMENT PAR LA GOUVERNANCE (ADG)', 14, 9);
  doc.setFont('times', 'bold'); doc.setFontSize(17);
  doc.text(propre(o.titre), 14, 19);
  if (o.code) { doc.setFontSize(13); doc.text(propre(o.code), L - 14, 19, { align: 'right' }); }
  doc.setTextColor(40, 30, 35);

  let y = 32;
  doc.setFont('times', 'italic'); doc.setFontSize(9.5);
  const info = vierge
    ? 'Fiche vierge à remplir à la main. Cocher une seule case sauf mention contraire.'
    : `Saisie par ${v.saisi_par ?? '-'} le ${dateFr(v.created_at)}${v.modifie_par ? ` · modifiée par ${v.modifie_par} le ${dateFr(v.updated_at)}` : ''} · téléchargée le ${dateFr(new Date().toISOString())}`;
  doc.text(propre(info), 14, y);
  y += 4;

  const style = {
    theme: 'grid' as const,
    styles: { font: 'times', fontSize: 10.5, cellPadding: 2.2, lineColor: [230, 214, 221] as [number, number, number], lineWidth: 0.2, textColor: [34, 22, 28] as [number, number, number] },
    headStyles: { fillColor: ROSE_PALE, textColor: ROSE, fontStyle: 'bold' as const, fontSize: 11.5 },
    columnStyles: { 0: { cellWidth: 72, fontStyle: 'bold' as const }, 1: { cellWidth: 'auto' as const } },
    margin: { left: 14, right: 14, top: 14, bottom: 16 },
  };

  if (o.enTete?.length) {
    autoTable(doc, { ...style, startY: y + 2, head: [[{ content: 'Identification', colSpan: 2 }]], body: o.enTete.map(([a, b]) => [propre(a), propre(b || '-')]) });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  for (const s of o.form.sections) {
    if (!vierge && s.si && !s.si(v)) continue;
    const champs = s.champs.filter((c) => vierge || !c.si || c.si(v));
    if (!champs.length) continue;
    const body = champs.map((c) => [
      propre(c.label + (c.required ? ' *' : '')),
      propre(vierge ? caseVierge(c, o.sites) : valeurChamp(c, v[c.name], o.sites)),
    ]);
    autoTable(doc, {
      ...style,
      startY: y + 4,
      head: [[{ content: propre(s.titre), colSpan: 2 }]],
      body,
      bodyStyles: vierge ? { minCellHeight: 9 } : {},
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  if (vierge) {
    y += 10;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    doc.text('Nom, qualification et signature : ______________________________', 14, y);
  }

  // Pied de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.setTextColor(110, 98, 104);
    const gauche = o.confidentiel ? 'Document confidentiel - données de santé. À conserver sous clé.' : 'Octobre Rose 2026 - ADG';
    doc.text(propre(gauche), 14, 290);
    doc.text(`Page ${i} / ${n}`, L - 14, 290, { align: 'right' });
  }

  doc.save(o.nomFichier.replace(/[^\w.-]+/g, '_'));
}
