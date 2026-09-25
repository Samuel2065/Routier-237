<?php

/*
|--------------------------------------------------------------------------
| Messages de validation (français)
|--------------------------------------------------------------------------
|
| Règles utilisées par l'API Routier+237. Une règle absente de ce fichier
| retombe sur la langue de secours (APP_FALLBACK_LOCALE=en).
|
*/

return [
    'accepted' => 'Le champ :attribute doit être accepté.',
    'after' => 'Le champ :attribute doit être une date postérieure au :date.',
    'after_or_equal' => 'Le champ :attribute doit être une date postérieure ou égale au :date.',
    'array' => 'Le champ :attribute doit être une liste.',
    'before' => 'Le champ :attribute doit être une date antérieure au :date.',
    'before_or_equal' => 'Le champ :attribute doit être une date antérieure ou égale au :date.',
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'confirmed' => 'La confirmation du champ :attribute ne correspond pas.',
    'date' => 'Le champ :attribute doit être une date valide.',
    'date_format' => 'Le champ :attribute doit respecter le format :format.',
    'different' => 'Les champs :attribute et :other doivent être différents.',
    'distinct' => 'Le champ :attribute contient une valeur en double.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'dimensions' => "L'image :attribute doit mesurer entre 64 et 5000 pixels de côté.",
    'enum' => 'La valeur du champ :attribute est invalide.',
    'exists' => 'La valeur du champ :attribute est invalide.',
    'file' => 'Le champ :attribute doit être un fichier.',
    'image' => 'Le champ :attribute doit être une image.',
    'in' => 'La valeur du champ :attribute est invalide.',
    'integer' => 'Le champ :attribute doit être un nombre entier.',
    'max' => [
        'array' => 'Le champ :attribute ne peut pas contenir plus de :max éléments.',
        'file' => 'Le fichier :attribute ne peut pas dépasser :max Ko.',
        'numeric' => 'Le champ :attribute ne peut pas dépasser :max.',
        'string' => 'Le champ :attribute ne peut pas dépasser :max caractères.',
    ],
    'min' => [
        'array' => 'Le champ :attribute doit contenir au moins :min élément(s).',
        'numeric' => 'Le champ :attribute doit être au moins égal à :min.',
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
    ],
    'mimes' => 'Le champ :attribute doit être un fichier de type : :values.',
    'numeric' => 'Le champ :attribute doit être un nombre.',
    'password' => [
        'letters' => 'Le champ :attribute doit contenir au moins une lettre.',
        'mixed' => 'Le champ :attribute doit contenir au moins une majuscule et une minuscule.',
        'numbers' => 'Le champ :attribute doit contenir au moins un chiffre.',
        'symbols' => 'Le champ :attribute doit contenir au moins un symbole.',
        'uncompromised' => 'Ce :attribute est apparu dans une fuite de données : choisissez-en un autre.',
    ],
    'prohibited' => 'Le champ :attribute n\'est pas autorisé.',
    'prohibited_if' => 'Le champ :attribute n\'est pas autorisé quand :other vaut :value.',
    'prohibited_unless' => 'Le champ :attribute n\'est autorisé que si :other vaut :values.',
    'regex' => 'Le format du champ :attribute est invalide.',
    'required' => 'Le champ :attribute est obligatoire.',
    'required_if' => 'Le champ :attribute est obligatoire quand :other vaut :value.',
    'string' => 'Le champ :attribute doit être du texte.',
    'unique' => 'Cette valeur de :attribute est déjà utilisée.',

    'attributes' => [
        'name' => 'nom',
        'email' => 'e-mail',
        'phone' => 'téléphone',
        'password' => 'mot de passe',
        'address' => 'adresse',
        'description' => 'description',
        'status' => 'statut',
        'role' => 'rôle',
        'agency_id' => 'agence',
        'organization_id' => 'organisation',
        'city_id' => 'ville',
        'departure_city_id' => 'ville de départ',
        'destination_city_id' => "ville d'arrivée",
        'travel_class_id' => 'classe',
        'route_id' => 'itinéraire',
        'vehicle_id' => 'véhicule',
        'trip_id' => 'trajet',
        'date' => 'date',
        'departure_date' => 'date de départ',
        'departure_time' => 'heure de départ',
        'price' => 'prix',
        'capacity' => 'capacité',
        'registration_number' => 'immatriculation',
        'brand' => 'marque',
        'model' => 'modèle',
        'employee_number' => 'matricule',
        'hired_at' => "date d'embauche",
        'license_number' => 'numéro de permis',
        'license_expires_at' => "date d'expiration du permis",
        'passengers' => 'passagers',
        'method' => 'moyen de paiement',
        'outcome' => 'résultat',
        'avatar' => 'photo de profil',
    ],
];
