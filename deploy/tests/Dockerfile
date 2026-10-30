# CI uniquement : une machine proche de Hostinger (PHP 8.3, Apache + .htaccess, client MariaDB,
# rsync, proc_open désactivé) pour jouer les vrais scripts de déploiement de bout en bout.
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends mariadb-client rsync curl libzip-dev \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql zip bcmath \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

# Même restriction que le PHP de Hostinger (ligne de commande et web).
RUN echo 'disable_functions=proc_open' > /usr/local/etc/php/conf.d/zz-hostinger.ini
