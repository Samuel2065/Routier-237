<?php

namespace App\Payments\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Le moyen de paiement demandé n'est pas disponible (intégration non configurée,
 * simulation interdite en production, fournisseur injoignable) : 503.
 */
class PaymentProviderUnavailable extends HttpException
{
    public function __construct(string $message = 'Ce moyen de paiement est momentanément indisponible.')
    {
        parent::__construct(503, $message);
    }
}
