const g_doors_grid = document.getElementById( 'doors-grid' );
const g_storage    = 'Atlanticity91_AdventCalendar_v1';
const g_cases = [
    { title : 'Debut du voyage', text : 'Le véritable voyage de découverte ne consiste pas à chercher de nouveaux paysages, mais à avoir de nouveaux yeux.<br><span class="author">- Marcel Proust</span>' },
    { title : 'Motivation', text : 'N\'oublie jamais à quel point tu es forte et capable. Tu as tout ce qu\'il faut pour réussir ce que tu entreprends !' },
    { title : 'Encouragement', text : 'Tu as du talent, de la valeur, et tu as changé ma vie.' },
    { title : 'Soutien', text : 'Je t\'envoie un câlin virtuel pour te rappeler que tu n\'es pas seule.' },
    { title : 'Citation', text : 'Il n\'y a pas de lieu comme chez soi.<br><span class="author">- Le Magicien d\'Oz</span>' },
    { title : 'Rêves', text : 'La persévérance paie. Accroche-toi à tes rêves, ils sont à portée de main. Tu es une vraie battante.' },
    { title : 'Action', text : 'Fais quelque chose qui te fait rire aux éclats aujourd\'hui. Laisse l\'insouciance t\'envahir.' },
    { title : 'Citation', text : 'Carpe Diem. Profitez du jour présent. Rendez votre vie extraordinaire.<br><span class="author">- Le Cercle des Poètes Disparus</span>' },
    { title : 'Motivation', text : 'Fais un pas à la fois. Même les petits progrès t\'emmènent vers de grandes choses. Je crois en toi !' },
    { title : 'Lumière', text : 'Le monde est plus beau grâce à la lumière que tu dégages. Ne t\'éteins jamais.' },
    { title : 'Citation', text : 'L\'imagination est plus importante que la connaissance.<br><span class="author">- Albert Einstein</span>' },
    { title : 'Citation', text : 'Prends un moment aujourd\'hui pour t\'aimer. Tu le mérites tellement.' },
    { title : 'Citation', text : 'La vie passe si vite. Si vous ne vous arrêtez pas et regardez autour de vous de temps en temps, vous pourriez la manquer.<br><span class="author">- La Folle Journée de Ferris Bueller</span>' },
    { title : 'Action', text : 'Regarder un film de Noël et boire un chocolat chaud.' },
    { title : 'Citation', text : 'Faites de votre vie un rêve, et de ce rêve une réalité.<br><span class="author">- Antoine de Saint-Exupéry</span>' },
    { title : 'Encouragement', text : 'Tu es une personne merveilleuse, à l\'intérieur comme à l\'extérieur. Ne laisse jamais personne te faire douter de ta valeur.' },
    { title : 'Action', text : 'Chanter une chanson de Noël à tue-tête (même si c\'est faux !).' },
    { title : 'Citation', text : 'Le bonheur ne se trouve pas, il se construit.<br><span class="author">- Bouda</span>' },
    { title : 'Citation', text : 'Garde la foi. Crois en toi.<br><span class="author">- Rocky</span>' },
    { title : 'Citation', text : 'Le succès, c\'est d\'aller d\'échec en échec sans perdre son enthousiasme.<br><span class="author">- Winston Churchill</span>' },
    { title : 'Action', text : 'Écrire un message positif (Citation, poème, ou mot doux) et le laisser dans une poche de manteau.' },
    { title : 'Citation', text : 'Il faut toujours un peu de folie pour faire un pas.<br><span class="author">- Bienvenue à Gattaca</span>' },
    { title : 'Motivation', text : 'C\'est normal de ne pas être au top tous les jours. Sois douce avec toi-même.' },
    { title : 'Citation', text : 'Le bonheur n\'est pas une destination à atteindre, mais une maison où revenir.' },
    { title : 'Fin du voyage', text : 'Après le voyage, l\'arrivée. Que cette journée soit remplie de chaleur, de rires et de tout l\'amour que tu mérites. Merci d\'être une amie si lumineuse.<br><span class="author">- Joyeux Noël !</span>' }
];

let opened_doors = new Set( );

function load_doors( ) {
    try {
        const stored = localStorage.getItem( g_storage );

        if ( stored ) {
            const data = JSON.parse( stored ).map( Number );

            opened_doors = new Set( data );
        }
    } catch ( e ) {
        console.error( 'Could not load from localStorage : ', e );
    }
}

function save_doors( ) {
    try {
        const data = Array.from( opened_doors );
        const content = JSON.stringify( data );

        localStorage.setItem( g_storage, content );
    } catch ( e ) {
        console.error( 'Could not save to localStorage:', e );
    }
}

function get_available_doors( ) {
    const today = new Date( );
    const month = today.getMonth( );
    
    if ( month !== 11 )
        return 0;
    
    const day = today.getDate( );

    if ( day < g_cases.length )
        return day;

    return g_cases.length;
}
        
function create_card( day, content, animationDirectionClass = '' ) {
    const card_content = `
        <div id='card-day-${day}' class='persistent-card p-4 rounded-xl shadow-xl border-t-4 border-red-600 ${animationDirectionClass}'>
            <h2 class='text-lg font-bold mb-1 text-red-700'>Jour ${day}: ${content.title}</h2>
            <p class='text-gray-800 text-sm'>${content.text}</p>
        </div>`;
        
    const element = document.createElement( 'div' );

    element.innerHTML = card_content.trim( );

    return element.firstChild;
}

function open_door(day, door, wrapper, alignClass, isOpened) {
    let execute_open = ( ) => {
        const is_first_open = !isOpened;
        const content = g_cases[ day - 1 ];

        let card_element = wrapper.querySelector( '.persistent-card' );

        if ( is_first_open ) {
            door.onclick = null;
            door.classList.add( 'opened' );

            opened_doors.add( day );
            
            save_doors( );

            setTimeout( ( ) => {
                card_element.scrollIntoView( {
                    behavior : 'smooth',
                    block : 'center' 
                } );
            }, 800 );
        }

        if ( card_element )
            return;
        
        let animation_direction = 'initial-animation-state from-left';
        
        if ( alignClass.includes( 'align-right' ) )
            animation_direction = 'initial-animation-state from-right';
            
        card_element = create_card( day, content, animation_direction );
            
        wrapper.appendChild( card_element );

        setTimeout( ( ) => {
            void card_element.offsetWidth;
            card_element.classList.remove( 'initial-animation-state' );
        }, 50 );
    }

    if ( !door.classList.contains( 'opened' ) ) {
        const ribbon = door.querySelector( '.ribbon' );
        
        if ( ribbon )
            ribbon.classList.add( 'tear' );

        door.classList.add( 'shaking' );

        setTimeout( ( ) => {
            door.classList.remove( 'shaking' );

            execute_open( );
        }, 400 );
    } else 
        execute_open( );
}

function create_calendar( ) {
    let create_element = ( parent, type, class_spec, content = '' ) => {
        let element = document.createElement( type );

        element.className = class_spec;
        element.innerHTML = content.trim( );

        if ( parent != null )
            parent.appendChild( element );

        return element;
    };

    let get_wrapper_alignement = ( day ) => {
        let wrapper_alignement = 'align-left';

        if ( day % 4 === 0 )
            wrapper_alignement = 'align-right';
        else if ( day % 4 === 2 )
            wrapper_alignement = 'align-center';

        return wrapper_alignement;
    };

    let get_door_class = ( day, is_opened, is_available ) => {
        let door_class = 'door flex items-center justify-center m-2 font-extrabold text-xl relative z-10 text-white';
        
        if ( is_opened )
            door_class += ' opened';
        else if ( !is_available )
            door_class += ' locked bg-gray-700 text-gray-400';
        else {
            if ( day % 2 === 0 )
                door_class += ' bg-emerald-600 hover:bg-emerald-500'; 
            else
                door_class += ' bg-red-700 hover:bg-red-600';
        }

        return door_class;
    };

    let door_to_center = null;
    let available_door = get_available_doors( );

    for ( let day = 1; day <= g_cases.length; day++ ) {
        const is_available = day <= available_door;
        const is_opened = opened_doors.has(day);

        const wrapper_alignement = get_wrapper_alignement( day );
        const wrapper_class      = `door-wrapper flex flex-col items-start p-1` + wrapper_alignement;
        const wrapper = create_element( null, 'div', wrapper_class );
        
        const door_class = get_door_class( day, is_opened, is_available );
        const door = create_element( wrapper, 'div', door_class, `<div class='shine'></div><h2 class='door-day'>${day}</h2>` );
        
        door.id = `door-${day}`;

        create_element( door, 'span', 'bow' );
        create_element( door, 'div', 'ribbon', `<div class='ribbon-v'></div><div class='ribbon-h'></div>` );

        if ( is_opened ) {
            const content = g_cases[ day - 1 ]; 
            const card    = create_card( day, content );
            
            wrapper.appendChild( card );
            door.onclick = null;
        }
        
        if ( is_available || !is_opened ) {
            door.onclick = ( e ) => {
                e.stopPropagation( );
                
                open_door( day, door, wrapper, wrapper_alignement, is_opened );
            };

            if ( day <= available_door )
                door_to_center = wrapper;
        }
        
        g_doors_grid.appendChild( wrapper );
    }

    return door_to_center;
}

window.onload = ( ) => {
    console.log( g_cases.length );
    load_doors( );
    
    let door_to_center = create_calendar( );
    
    if ( door_to_center != null ) {
        setTimeout( ( ) => {
            door_to_center.scrollIntoView( {
                behavior: 'smooth',
                block: 'center' 
            } );
        }, 100 );
    }
}
