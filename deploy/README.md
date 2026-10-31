# Déploiement — Hostinger (routier237.artischools.com)

Modèle : le déploiement de La Pépinière. GitHub Actions construit tout (React `dist/`,
Laravel `vendor/`) et envoie une seule archive en SSH. Le serveur n'exécute jamais Node ni Composer.

## Organisation sur le serveur

```
~/domains/routier237.artischools.com/
├─ public_html/           site React (racine de routier237.artischools.com) + .htaccess
│  └─ api/                index.php + .htaccess (racine de api.routier237.artischools.com)
│     └─ storage -> ../../app/shared/storage/app/public   (photos de profil)
├─ app/
│  ├─ releases/<id>/      backend/ web/ api/ deploy/   (5 gardées, plus l'active et la précédente)
│  ├─ current -> releases/<id>/backend
│  └─ shared/             .env (chmod 600) + storage/ (photos, Firebase, journaux) — jamais supprimé
└─ backups/               db-*.sql.gz, public_html-*.tar.gz (10 gardées, chmod 600), deploys.log
```

L'ancienne installation manuelle `~/routier237-api` (git clone) n'est plus utilisée après le premier
déploiement ; elle est conservée telle quelle comme filet de sécurité.

## Restrictions Hostinger prises en compte

- **`proc_open` est désactivé.** Composer en a besoin pour ses scripts (`package:discover`) : `vendor/`
  vient donc de GitHub, et le contrôle de démarrage est `deploy/preflight.php`. `migrate`, `db:seed`,
  `optimize` et les commandes `routier:*`, `reservations:*`, `trips:*` n'en ont pas besoin (vérifié par
  le test e2e, `proc_open` désactivé).
- **`php artisan schedule:run` ne fonctionne pas** (il lance chaque tâche avec `proc_open`) : les tâches
  Cron appellent chaque commande directement (plus bas).
- **Pas de Reverb** (processus permanent impossible) : `BROADCAST_CONNECTION=null`, l'application se
  rafraîchit par interrogation. **Pas de worker** : `QUEUE_CONNECTION=sync`.

## Avant le premier déploiement (une seule fois, en SSH)

Le `.env` en ligne et le stockage sont repris de l'ancienne installation : **même `APP_KEY`**, même
base de données, mêmes photos et même fichier Firebase. Rien n'est affiché à l'écran.

```
D=~/domains/routier237.artischools.com
OLD=~/routier237-api/backend/routier-api
mkdir -p $D/app/shared/storage/app && chmod 711 $D/app $D/app/shared
if [ -e $D/app/shared/.env ]; then echo "STOP : .env existe déjà, non remplacé"; else cp $OLD/.env $D/app/shared/.env && chmod 600 $D/app/shared/.env; fi
cp -an $OLD/storage/app/. $D/app/shared/storage/app/     # photos (public/) et Firebase (private/), sans écraser
stat -c %a $D/app/shared/.env                             # doit afficher 600
```

Puis vérifier dans `$D/app/shared/.env` (avec `nano`, sans toucher `APP_KEY`) les lignes de
`deploy/env.production.example` : `APP_DEBUG=false`, `APP_URL` et `FRONTEND_URL` en https,
`BROADCAST_CONNECTION=null`, `QUEUE_CONNECTION=sync`. Pendant la phase de test : `APP_ENV=staging`.

## Secrets GitHub (Settings → Environments → production)

| Secret | Valeur |
|---|---|
| `SSH_HOST` | adresse IP SSH (hPanel → Avancé → Accès SSH) |
| `SSH_PORT` | `65002` |
| `SSH_USER` | utilisateur SSH (hPanel) |
| `SSH_PRIVATE_KEY` | clé privée **dédiée au déploiement**, sans phrase de passe |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan -p 65002 <hôte>`, vérifiée avec les empreintes du hPanel |

Créer la clé sur son ordinateur : `ssh-keygen -t ed25519 -N "" -C github-deploy-routier -f routier_deploy`,
ajouter `routier_deploy.pub` dans hPanel → Accès SSH → Clés SSH, coller `routier_deploy` dans le secret,
puis supprimer le fichier privé de l'ordinateur. Protéger l'environnement `production` par une approbation.

## Lancer un déploiement

GitHub → Actions → « Déploiement (Hostinger) » → Run workflow :

1. **`dry_run` coché (défaut)** : build, tests, e2e et diagnostic SSH en lecture seule. Rien ne change.
2. **Premier déploiement** : décocher `dry_run`, cocher `allow_initial` (`run_migrations` décoché : la
   base existe déjà). L'installation manuelle de `public_html` est sauvegardée (`public_html-initial-*`).
3. **Déploiements suivants** : décocher `dry_run` ; cocher `run_migrations` seulement si une migration est
   ajoutée (la base est sauvegardée et vérifiée avant).

Ordre sur le serveur : contrôles → preflight → sauvegardes vérifiées → [migrations] → bascule →
vérifications HTTP. Un échec avant la bascule laisse le site inchangé.

## Tâches Cron (hPanel → Avancé → Tâches Cron)

`schedule:run` ne fonctionnant pas, une tâche par commande, type « Personnalisé ». PHP : `/usr/bin/php`
(8.4 en ligne de commande, vérifié le 31/10/2026). **Envelopper dans `/bin/bash -c '…'`** : hPanel ajoute
sa propre redirection après la commande, qui écrase la nôtre (fichier créé mais vide, sortie seulement
dans « Afficher le résultat »). Chemin complet, pas de `~`.

| Fréquence | Commande |
|---|---|
| `* * * * *` | `/bin/bash -c 'cd /home/u133979320/domains/routier237.artischools.com/app/current && /usr/bin/php artisan reservations:expire >> storage/logs/cron.log 2>&1'` |
| `30 0 * * *` | `/bin/bash -c 'cd /home/u133979320/domains/routier237.artischools.com/app/current && /usr/bin/php artisan trips:complete-past >> storage/logs/cron.log 2>&1'` |
| `0 3 * * *` | `/bin/bash -c 'cd /home/u133979320/domains/routier237.artischools.com/app/current && /usr/bin/php artisan sanctum:prune-expired --hours=24 >> storage/logs/cron.log 2>&1'` |

Contrôle : `tail -5 ~/domains/routier237.artischools.com/app/shared/storage/logs/cron.log` (une ligne
« 0 réservation(s) expirée(s). » par minute). Dans hPanel, la minute doit être `30` seule (pas `0,30`).

## Retour arrière

```
bash ~/domains/routier237.artischools.com/app/releases/<id>/deploy/rollback.sh routier237.artischools.com
```

Revient à la version précédente (site, API, Laravel). La base n'est pas restaurée : en cas de migration,
`gunzip -c backups/db-<date>.sql.gz | mysql <base>`.

## Diagnostic à la main (lecture seule)

```
tr -d '\r' < deploy/diagnose.sh | ssh -p 65002 <utilisateur>@<hôte> 'bash -s -- routier237.artischools.com'
```
