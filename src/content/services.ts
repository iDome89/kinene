import { services, type ServiceId } from '@/config/business';

const checkIn = (id: ServiceId) => `${services[id].checkInFrom}—${services[id].checkInTo}`;
const checkOut = (id: ServiceId) => `${services[id].checkOutFrom}—${services[id].checkOutTo}`;

export interface ServiceCopy {
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly lead: string;
  readonly forWho: readonly string[];
  readonly dayInTheLife: readonly { time: string; what: string }[];
  readonly included: readonly string[];
  readonly notes: readonly string[];
}

export const serviceCopy: Readonly<Record<ServiceId, ServiceCopy>> = {
  'asilo-diurno': {
    metaTitle: 'Asilo diurno per cani',
    metaDescription:
      'Asilo diurno per cani a Guiglia (MO): giornata in gruppi selezionati, gioco, socializzazione controllata e riposo. Consegna 07:00—12:00, ritiro 14:00—20:00.',
    lead:
      'Una giornata strutturata, non un parcheggio. Il cane entra la mattina, trova un gruppo compatibile con il suo carattere e rientra a casa la sera stanco nel modo giusto.',
    forWho: [
      'Chi lavora fuori casa e non vuole lasciare il cane solo dieci ore',
      'Cani adulti che hanno bisogno di movimento e stimoli quotidiani',
      'Chi sta rieducando un cane che tira o si annoia in casa',
    ],
    dayInTheLife: [
      { time: checkIn('asilo-diurno'), what: 'Ingresso scaglionato, così ogni arrivo è gestito senza confusione al cancello.' },
      { time: 'Mattina', what: 'Uscita nelle aree recintate, attività di movimento e lavoro di gruppo.' },
      { time: 'Metà giornata', what: 'Riposo obbligatorio. Un cane che non stacca mai diventa un cane sovraeccitato.' },
      { time: 'Pomeriggio', what: 'Gioco, olfattivo, esercizi di autocontrollo con i comandi di base.' },
      { time: checkOut('asilo-diurno'), what: 'Uscita. Ti raccontiamo com’è andata la giornata, comportamento incluso.' },
    ],
    included: [
      'Inserimento in un gruppo selezionato per carattere, taglia ed energia',
      'Supervisione continua da parte di un’addestratrice cinofila',
      'Accesso alle aree verdi recintate',
      'Somministrazione del pasto che porti da casa, se previsto',
      'Aggiornamento sul comportamento alla riconsegna',
    ],
    notes: [
      'L’asilo diurno non prevede pernottamento: se ti servono anche le notti, guarda l’asilo notturno o la pensione.',
      'Ogni prenotazione copre una singola giornata. Per più giorni di fila invia una richiesta per ciascuno.',
    ],
  },

  'asilo-notturno': {
    metaTitle: 'Asilo notturno per cani',
    metaDescription:
      'Asilo notturno per cani a Guiglia (MO): consegna 16:00—20:00, ritiro il mattino dopo 07:00—12:00. Una notte sola, seguita da un’addestratrice cinofila.',
    lead:
      'Per l’imprevisto, il turno di notte, la cena fuori città. Consegni la sera e ritiri la mattina dopo, senza dover organizzare un soggiorno intero.',
    forWho: [
      'Chi ha un impegno serale o notturno isolato',
      'Chi sta traslocando o ha lavori in casa',
      'Chi vuole testare come reagisce il proprio cane a una notte fuori, prima di prenotare una pensione',
    ],
    dayInTheLife: [
      { time: checkIn('asilo-notturno'), what: 'Consegna. Ci lasci il cibo della cena e della colazione, e la sua coperta se vuoi.' },
      { time: 'Sera', what: 'Ultima uscita, cena secondo i tuoi orari, decompressione.' },
      { time: 'Notte', what: 'Riposo in spazio dedicato. Nessuna promiscuità notturna tra cani che non si conoscono.' },
      { time: 'Mattina', what: 'Uscita, colazione, movimento.' },
      { time: checkOut('asilo-notturno'), what: 'Ritiro, con il resoconto della notte.' },
    ],
    included: [
      'Una notte con sistemazione dedicata',
      'Cena e colazione con il cibo che fornisci tu',
      'Uscite serali e mattutine',
      'Reperibilità in caso di problemi durante la notte',
    ],
    notes: [
      'L’asilo notturno copre esattamente una notte. Per più notti consecutive la formula corretta è la pensione.',
      'Il ritiro avviene sempre il mattino successivo alla consegna, entro le ore 12:00.',
    ],
  },

  pensione: {
    metaTitle: 'Pensione per cani',
    metaDescription:
      'Pensione per cani a Guiglia (MO), fino a 14 notti. Ampi spazi verdi, routine personalizzate, gestione di un’addestratrice cinofila. Niente box.',
    lead:
      'Soggiorni fino a due settimane. Non andiamo oltre di proposito: oltre quel limite un cane ha bisogno della sua famiglia, non di una struttura, per quanto buona sia.',
    forWho: [
      'Vacanze e trasferte in cui il cane non può venire',
      'Ricoveri, imprevisti familiari, periodi di emergenza',
      'Chi vuole una struttura gestita da chi conosce le razze impegnative',
    ],
    dayInTheLife: [
      { time: 'Mattina presto', what: 'Prima uscita e colazione, negli orari che ci hai indicato tu.' },
      { time: 'Mattina', what: 'Attività nelle aree verdi e lavoro di gruppo con i cani compatibili.' },
      { time: 'Pomeriggio', what: 'Riposo, poi attività olfattive e gioco.' },
      { time: 'Sera', what: 'Cena e ultima uscita.' },
      { time: 'Durante il soggiorno', what: 'Aggiornamenti al proprietario. Ti scriviamo noi, non devi rincorrerci.' },
    ],
    included: [
      'Sistemazione per l’intera durata del soggiorno',
      'Routine di pappa, nanna e gioco calibrata sul singolo cane',
      'Gestione dei gruppi da parte di un’addestratrice cinofila',
      'Somministrazione di terapie, solo dietro prescrizione veterinaria scritta',
      'Aggiornamenti periodici al proprietario',
    ],
    notes: [
      'Il check-in si effettua entro le ore 12:00 del giorno di arrivo.',
      'Il soggiorno massimo è di 14 notti. Non facciamo eccezioni su questo punto.',
      'Il saldo si effettua il giorno del check-in.',
    ],
  },
};
