/**
 * The glossary's terms, as data.
 *
 * The page renders from this and so does its `DefinedTermSet` structured data,
 * which is the point: a glossary whose markup is written separately from its
 * prose drifts the first time someone edits one and not the other.
 *
 * Definitions are written in "X is a Y that does Z" form on purpose. It is the
 * shape an answer engine can lift as a standalone sentence, and it is also
 * simply the clearest way to define something for a reader who arrived here
 * from the middle of an article.
 *
 * `seeAlso` carries article slugs, not headlines — the page resolves them to
 * live headlines at render time so a retitled article does not leave a stale
 * label behind.
 */

const TABUK = 'samaya-group-completes-the-tabuk-380-kv-transmission-line';
const AL_JAWF = 'samaya-group-completes-the-al-jawf-380-kv-transmission-line';
const DARAA = 'icco-completes-the-rural-damascus-daraa-400-kv-transmission-line';
const KWARA = 'icco-delivers-the-kwara-330-kv-transmission-substation';
const NNEWI = 'icco-delivers-the-nnewi-800-mva-transmission-substation';

export interface GlossaryTerm {
  /** Anchor fragment. Stable — these are linked to from article bodies. */
  slug: string;
  term: string;
  /** Expansion of an abbreviation, or the names the same thing goes by. */
  also?: string;
  definition: string;
  /** Slugs of articles where the term appears in context. */
  seeAlso?: string[];
}

export interface GlossarySection {
  slug: string;
  title: string;
  blurb: string;
  terms: GlossaryTerm[];
}

export const GLOSSARY: GlossarySection[] = [
  {
    slug: 'transmission-lines',
    title: 'Transmission lines',
    blurb:
      'The route, the structures that carry it and the cables strung between them.',
    terms: [
      {
        slug: 'transmission-line',
        term: 'Transmission line',
        definition:
          'A transmission line is a high-voltage circuit that moves bulk electricity between generating stations, substations and regional networks over long distances. Higher voltage means less current for the same power, and less current means less energy lost as heat along the route — which is why long-distance transfer happens at 330 kV and above rather than at the voltages used closer to demand.',
        seeAlso: [TABUK, AL_JAWF, DARAA],
      },
      {
        slug: 'phase-conductor',
        term: 'Phase conductor',
        definition:
          'A phase conductor is the cable that carries current along a transmission line. A three-phase circuit has three of them; a double-circuit line has six. Route length and conductor length are very different numbers as a result — a 112 km line can contain more than 2,700 km of phase conductor.',
        seeAlso: [TABUK, DARAA],
      },
      {
        slug: 'bundled-conductor',
        term: 'Bundled conductor',
        also: 'Quad bundle, sub-conductor',
        definition:
          'A conductor bundle is a group of smaller sub-conductors carrying a single phase in place of one large cable. A quad bundle uses four. Splitting the phase lowers electrical losses and suppresses corona — the discharge that forms around a conductor surface at high voltage, wasting energy and generating audible noise.',
        seeAlso: [TABUK, DARAA],
      },
      {
        slug: 'double-circuit',
        term: 'Double-circuit line',
        definition:
          'A double-circuit line carries two independent three-phase circuits on the same towers. One set of structures and one right of way deliver twice the transfer capacity, at the cost of both circuits sharing a single point of physical failure.',
        seeAlso: [TABUK, AL_JAWF, DARAA],
      },
      {
        slug: 'lattice-tower',
        term: 'Lattice tower',
        definition:
          'A lattice tower is a steel structure assembled on site from bolted angle sections rather than raised as a single fabricated column. It is the standard high-voltage form because it is strong for its weight, transportable in pieces, and can be built at positions no crane can reach.',
        seeAlso: [TABUK, DARAA],
      },
      {
        slug: 'suspension-tower',
        term: 'Suspension tower',
        definition:
          'A suspension tower is a structure that carries conductors through a straight section of route — holding them up rather than holding them back. Its insulator strings hang vertically and the load it takes is mostly the weight of the spans either side. Most towers on a line are suspension towers.',
        seeAlso: [TABUK, AL_JAWF, DARAA],
      },
      {
        slug: 'angle-tower',
        term: 'Angle tower',
        also: 'Corner tower',
        definition:
          'An angle tower is a structure used where a line changes direction. Conductors pull on it from two different bearings, so it must resist a transverse force a suspension tower never sees — which is why angle positions need heavier structures and larger foundations than the straight sections around them.',
        seeAlso: [TABUK, AL_JAWF, DARAA],
      },
      {
        slug: 'dead-end-tower',
        term: 'Dead-end tower',
        also: 'Terminal tower, tension tower',
        definition:
          'A dead-end tower is a structure that anchors the conductor system rather than merely supporting it. Its insulator strings run horizontally and take the full longitudinal pull of the conductors. Dead-end towers sit at the ends of a line, at substation entries, and anywhere the route needs mechanical restraint — including as a limit on how far a failure can propagate along the line.',
        seeAlso: [TABUK, AL_JAWF],
      },
      {
        slug: 'transposition-tower',
        term: 'Transposition tower',
        definition:
          'A transposition tower is a structure that rotates the relative positions of the three phases along a route. Each phase otherwise occupies the same physical position for the whole line and takes on a slightly different electrical impedance because of it; rotating them at intervals balances those characteristics across the complete circuit.',
        seeAlso: [TABUK],
      },
      {
        slug: 'insulator-string',
        term: 'Insulator string',
        definition:
          'An insulator string is a chain of glass, porcelain or composite units that holds a conductor while keeping it electrically separated from the earthed steel of the tower. Its length is set by the line voltage and by how much dust, salt or industrial pollution the site collects — contamination on the surface is what lets a flashover cross an otherwise adequate insulator.',
        seeAlso: [TABUK, AL_JAWF, DARAA],
      },
      {
        slug: 'spacer-damper',
        term: 'Spacer damper',
        definition:
          'A spacer damper is a fitting that holds the sub-conductors of a bundle at their designed separation while absorbing vibration between them. Without it the sub-conductors clash in wind, and the geometry the bundle depends on for its electrical behaviour stops being reliable.',
        seeAlso: [TABUK, DARAA],
      },
      {
        slug: 'vibration-damper',
        term: 'Vibration damper',
        definition:
          'A vibration damper is a weight fitted near a conductor support point to absorb wind-induced oscillation. The movement is small and continuous; over years it fatigues conductor strands and fittings at the clamps, which is where a line that is otherwise sound eventually fails.',
        seeAlso: [TABUK, AL_JAWF],
      },
      {
        slug: 'earthwire',
        term: 'Earthwire',
        also: 'Shield wire, ground wire',
        definition:
          'An earthwire is an uncharged cable strung above the phase conductors to intercept lightning and carry it to ground through the towers, so a strike does not reach the live conductors. It carries no load current in normal operation.',
        seeAlso: [AL_JAWF, DARAA],
      },
      {
        slug: 'opgw',
        term: 'OPGW',
        also: 'Optical Ground Wire',
        definition:
          'OPGW is a cable that does two jobs at once: its outer layers perform the shielding role of a conventional earthwire, while optical fibres inside it carry protection, control and communication data along the route. It is what allows a modern high-voltage line to be operated as part of a network rather than as an isolated physical connection.',
        seeAlso: [TABUK, AL_JAWF, DARAA, NNEWI],
      },
      {
        slug: 'stringing',
        term: 'Stringing',
        also: 'Conductor tensioning, sag',
        definition:
          'Stringing is the operation of pulling conductors through erected towers and tensioning them to a designed sag. Sag is calculated, not slack: it must keep the conductor clear of the ground on the hottest day, when the metal expands and the span drops, without overstressing the structures on the coldest.',
        seeAlso: [TABUK, DARAA],
      },
    ],
  },
  {
    slug: 'substations',
    title: 'Substations',
    blurb: 'Where the network changes voltage, direction or configuration.',
    terms: [
      {
        slug: 'substation',
        term: 'Substation',
        definition:
          'A substation is a node where a transmission network changes voltage, direction or configuration. It transforms between voltage levels, switches circuits in and out of service, measures what is flowing through it, and isolates faults before they spread into the rest of the network.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'switchyard',
        term: 'Switchyard',
        definition:
          'A switchyard is the part of a substation operating at one voltage level, containing the busbars, breakers, disconnectors and instrument transformers for that level. A station serving 330 kV, 132 kV and 33 kV has three of them.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'bay',
        term: 'Bay',
        definition:
          'A bay is a controlled connection inside a substation: one line, transformer or reactor together with the switching, isolation, measurement and protection equipment that ties it to the busbar. Bays are how substation capacity is described — "six 330 kV bays" means six such connections, each able to be isolated without disturbing the others.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'busbar',
        term: 'Busbar',
        definition:
          'A busbar is the common conductor every bay in a switchyard connects to. It is the junction through which power is routed between incoming lines, transformers and outgoing circuits.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'sectionalising-bay',
        term: 'Sectionalising bay',
        also: 'Bus coupler',
        definition:
          'A sectionalising bay divides a busbar into separately operable sections. One part of a switchyard can then be taken out for maintenance, or isolated after a fault, while the rest keeps running — the difference between losing a section and losing a station.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'power-transformer',
        term: 'Power transformer',
        definition:
          'A power transformer is the machine that moves electricity between voltage levels. It is what changes the role of the electricity at a substation: at 330 kV power travels efficiently over distance, and at 132 kV or 33 kV it can be directed into networks closer to demand. Its capacity is rated in MVA.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'autotransformer',
        term: 'Autotransformer',
        definition:
          'An autotransformer is a transformer whose two windings are shared rather than separate. Where the voltage levels are close, it does the same work as a conventional unit in a smaller, cheaper and more efficient machine — the trade-off being that the two sides are no longer electrically separated.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'circuit-breaker',
        term: 'Circuit breaker',
        definition:
          'A circuit breaker is a switch built to interrupt fault current — thousands of amperes — within a fraction of a second, on command from a protection relay. Most of a substation exists to let electricity flow; the breaker exists for the moments when it must stop.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'disconnector',
        term: 'Disconnector',
        also: 'Isolator, disconnect switch',
        definition:
          'A disconnector is a switch that provides visible, verifiable separation after a circuit breaker has already interrupted the current. It cannot break load current, and it is not meant to: its purpose is proving a circuit is dead before anyone works on it.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'earthing-switch',
        term: 'Earthing switch',
        also: 'Grounding switch',
        definition:
          'An earthing switch connects isolated equipment to earth during maintenance, so that voltage induced from nearby live circuits cannot appear on something a crew has been told is safe to touch.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'surge-arrester',
        term: 'Surge arrester',
        definition:
          'A surge arrester is a device that limits the voltage able to appear across equipment. Below its threshold it conducts almost nothing; above it, it diverts the surge — from a lightning strike or a switching operation — safely to earth before insulation elsewhere in the station fails.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'instrument-transformer',
        term: 'Instrument transformer',
        also: 'Current transformer, voltage transformer',
        definition:
          'An instrument transformer is a current or voltage transformer that scales a high-voltage quantity down to something a relay or a meter can read. Every protection decision in a substation rests on the accuracy of these measurements — a relay can only be as correct as what it is given.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'gantry',
        term: 'Gantry',
        definition:
          'A gantry is the steel structure at a substation boundary where an overhead line terminates and its conductors transition into the switchyard. It is the physical handover point between a transmission line and a station.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'earthing-grid',
        term: 'Earthing grid',
        definition:
          'An earthing grid is a mesh of conductors buried beneath a substation that gives fault current a controlled path into the ground. It also keeps the voltage difference across the surface small enough to remain safe for anyone standing on it while a fault is being cleared.',
        seeAlso: [DARAA, NNEWI],
      },
      {
        slug: 'bund-wall',
        term: 'Bund wall',
        also: 'Oil containment',
        definition:
          'A bund wall is a containment barrier around a transformer that holds its insulating oil if the tank leaks or ruptures. A large power transformer contains tens of thousands of litres, and containing it is both an environmental and a fire-control measure.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'lilo',
        term: 'LILO',
        also: 'Line-in, line-out',
        definition:
          'A LILO is a connection arrangement that diverts an existing transmission line into a new substation and then returns it to its original route. It brings a station onto an established corridor without building a separate long-distance line to reach it.',
        seeAlso: [NNEWI],
      },
    ],
  },
  {
    slug: 'voltage-and-power',
    title: 'Voltage and power',
    blurb: 'The units these projects are measured in, and what they describe.',
    terms: [
      {
        slug: 'kv',
        term: 'kV',
        also: 'Kilovolt',
        definition:
          'A kilovolt is one thousand volts. Transmission networks are named by voltage — 330 kV, 380 kV, 400 kV — because voltage sets how much power a line can move and how far it can move it before losses make the route uneconomic.',
        seeAlso: [TABUK, DARAA, KWARA],
      },
      {
        slug: 'mva',
        term: 'MVA',
        also: 'Megavolt-ampere',
        definition:
          'MVA is the unit of apparent power, used to rate transformers and substations. It covers both the power that does work and the reactive power that circulates without doing any — which is why a transformer, whose limit is the current its windings can carry, is rated in MVA rather than MW.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'mvar',
        term: 'MVAr',
        also: 'Megavolt-ampere reactive',
        definition:
          'MVAr is the unit of reactive power, used to rate reactors, capacitors and other equipment whose purpose is voltage control rather than energy transfer.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'reactive-power',
        term: 'Reactive power',
        definition:
          'Reactive power is the component of alternating current that oscillates between the network and its equipment without delivering net energy. It cannot be avoided and it has to be managed: too little and system voltage sags, too much and voltage climbs above the range the network is designed to operate in.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'shunt-reactor',
        term: 'Shunt reactor',
        definition:
          'A shunt reactor is an inductive device connected across a line or busbar to absorb reactive power and bring voltage back down. A long transmission line generates reactive power on its own, most of all when it is lightly loaded — the reactor is what removes it.',
        seeAlso: [NNEWI],
      },
      {
        slug: 'variable-line-reactor',
        term: 'Variable line reactor',
        definition:
          'A variable line reactor is one whose absorption can be adjusted across a range — 25 to 62 MVAr, for instance — rather than providing a single fixed amount. It lets operators match compensation to conditions that change through the day, instead of treating a heavily loaded line and a lightly loaded one as the same case.',
        seeAlso: [KWARA, NNEWI],
      },
    ],
  },
  {
    slug: 'protection-and-control',
    title: 'Protection, control and communications',
    blurb: 'The systems that decide what the equipment does, and when.',
    terms: [
      {
        slug: 'protection-relay',
        term: 'Protection relay',
        definition:
          'A protection relay is the device that decides whether what it is measuring is a fault and, if so, which circuit breaker should open. It has to be fast enough to clear the fault before equipment is damaged, and selective enough not to disconnect healthy circuits alongside it.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'scada',
        term: 'SCADA',
        also: 'Supervisory Control and Data Acquisition',
        definition:
          'SCADA is the system that gives operators a live view of a substation — breaker and disconnector positions, transformer loading, voltage measurements, alarms — and lets authorised control commands be issued from the station or from a remote control centre.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'substation-automation-system',
        term: 'Substation Automation System',
        also: 'SAS',
        definition:
          'A substation automation system is the layer that ties a station’s protection, control, metering and recording devices into one coordinated system, so they exchange data and behave as a whole rather than as separate panels that happen to share a building.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'disturbance-recorder',
        term: 'Disturbance recorder',
        definition:
          'A disturbance recorder captures the current and voltage waveforms surrounding a fault at a resolution fine enough to reconstruct afterwards what happened and in what order. Without one, a cleared fault leaves only its consequences behind.',
        seeAlso: [KWARA],
      },
    ],
  },
  {
    slug: 'delivering-a-project',
    title: 'Delivering a project',
    blurb: 'How this work is contracted, built and handed over.',
    terms: [
      {
        slug: 'epc',
        term: 'EPC',
        also: 'Engineering, procurement and construction',
        definition:
          'An EPC contract makes one contractor responsible for the whole chain — detailed design, buying and transporting materials, and building the facility. The client holds a single party accountable for something that works, rather than coordinating separate designers, suppliers and builders and owning the gaps between them.',
        seeAlso: [TABUK, AL_JAWF, NNEWI],
      },
      {
        slug: 'greenfield',
        term: 'Greenfield',
        definition:
          'A greenfield project is one built on an undeveloped site, with no existing facility to work around. Access roads, drainage, foundations, earthing and buildings are all new — which removes the constraints of working beside live equipment and adds everything the site does not yet have.',
        seeAlso: [KWARA],
      },
      {
        slug: 'commissioning',
        term: 'Commissioning',
        definition:
          'Commissioning is the stage at which a completed facility is proved to work rather than assumed to. Protection settings are checked against the network design, control commands are traced to the equipment they actually reach, alarms are made to appear on demand, and the site is energised in a controlled sequence before it is handed to the operator.',
        seeAlso: [KWARA, NNEWI],
      },
      {
        slug: 'grid-integration',
        term: 'Grid integration',
        definition:
          'Grid integration is the point at which a finished line or substation stops being a construction project and becomes part of an operating network — connected, energised, visible to the control centre and carrying load under the operator’s instruction.',
        seeAlso: [AL_JAWF, KWARA],
      },
    ],
  },
];

/** Every term, flattened — for the JSON-LD and the index. */
export const ALL_TERMS: GlossaryTerm[] = GLOSSARY.flatMap((s) => s.terms);
