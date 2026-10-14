import { useState } from 'react';
import { leader, media, seance, support } from '../forms/definitions';
import { PageListe } from '../components/PageListe';
import { dateFr, lib } from '../lib/format';

export function PageSensibilisation() {
  return (
    <PageListe form={seance} ordre="date_seance" libelleNouveau="Nouvelle séance" nomExport="outil1_seances"
      intro={<p className="intro">Outil 1 – une fiche par séance (causerie, quartier, école, marché, lieu de culte).</p>}
      colonnes={[
        { titre: 'Date', rendu: (l) => dateFr(l.date_seance) },
        { titre: 'N°', rendu: (l) => String(l.numero ?? '') },
        { titre: 'Lieu', rendu: (l) => [lib('lieu_type', l.lieu_type), l.quartier].filter(Boolean).join(' – ') },
        { titre: 'Activité', rendu: (l) => lib('type_activite', l.type_activite) },
        { titre: 'Femmes', num: true, rendu: (l) => String(l.total_femmes ?? '') },
        { titre: 'Hommes', num: true, rendu: (l) => String(l.total_hommes ?? '') },
        { titre: 'Total', num: true, rendu: (l) => <strong>{String(l.total ?? '')}</strong> },
      ]} />
  );
}

export function PageCommunication() {
  const [onglet, setOnglet] = useState<'supports' | 'medias' | 'leaders'>('supports');
  return (
    <section>
      <p className="intro">Outil 6 – supports produits et diffusés, activités médias, leaders impliqués.</p>
      <div className="onglets" role="tablist">
        {([['supports', '6a · Supports'], ['medias', '6b · Médias'], ['leaders', '6c · Leaders']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={onglet === k} className={`onglet${onglet === k ? ' actif' : ''}`} onClick={() => setOnglet(k)}>{l}</button>
        ))}
      </div>
      {onglet === 'supports' && (
        <PageListe key="s" form={support} ordre="updated_at" libelleNouveau="Nouveau support" nomExport="outil6a_supports"
          colonnes={[
            { titre: 'Type', rendu: (l) => (l.type_support === 'autre' ? String(l.type_autre ?? 'Autre') : lib('type_support', l.type_support)) },
            { titre: 'Produits', num: true, rendu: (l) => String(l.qte_produite ?? 0) },
            { titre: 'Diffusés', num: true, rendu: (l) => String(l.qte_diffusee ?? 0) },
            { titre: 'Lieux / canaux', rendu: (l) => String(l.lieux_canaux ?? '') },
            { titre: 'Période', rendu: (l) => String(l.periode ?? '') },
          ]} />
      )}
      {onglet === 'medias' && (
        <PageListe key="m" form={media} ordre="date_activite" libelleNouveau="Nouvelle activité média" nomExport="outil6b_medias"
          colonnes={[
            { titre: 'Date', rendu: (l) => dateFr(l.date_activite) },
            { titre: 'Média', rendu: (l) => String(l.media ?? '') },
            { titre: 'Type', rendu: (l) => lib('type_media', l.type_media) },
            { titre: 'Format', rendu: (l) => String(l.format ?? '') },
            { titre: 'Diffusions', rendu: (l) => String(l.duree_diffusions ?? '') },
            { titre: 'Portée', num: true, rendu: (l) => (l.portee_estimee == null ? '' : Number(l.portee_estimee).toLocaleString('fr-FR')) },
          ]} />
      )}
      {onglet === 'leaders' && (
        <PageListe key="l" form={leader} ordre="updated_at" libelleNouveau="Nouveau leader" nomExport="outil6c_leaders"
          colonnes={[
            { titre: 'Nom', rendu: (l) => String(l.nom ?? '') },
            { titre: 'Catégorie', rendu: (l) => lib('categorie', l.categorie) },
            { titre: 'Localité', rendu: (l) => String(l.localite ?? '') },
            { titre: 'Rôle', rendu: (l) => (Array.isArray(l.roles) ? l.roles.join(', ') : '') },
          ]} />
      )}
    </section>
  );
}
