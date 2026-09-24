<?php

namespace App\Payments\Contracts;

use App\Models\Payment;
use App\Payments\Data\PaymentInitiation;
use App\Payments\Data\PaymentResult;
use Illuminate\Http\Request;

/**
 * Adaptateur d'un fournisseur de paiement (Orange Money, MTN MoMo, carte).
 *
 * Le domaine réservation ne dépend que de cette interface : brancher un fournisseur
 * réel consiste à implémenter ces méthodes, sans modifier réservations ni paiements.
 */
interface PaymentGateway
{
    /**
     * Identifiant de la passerelle (colonne payments.provider, URL de webhook).
     */
    public function name(): string;

    /**
     * Demande le paiement au fournisseur (ex. push USSD sur le téléphone du client).
     *
     * @param  array{phone?: string|null}  $context
     */
    public function initiate(Payment $payment, array $context = []): PaymentInitiation;

    /**
     * Vérifie l'authenticité d'une notification du fournisseur (signature) et la traduit.
     * Doit lever une exception si la signature est invalide.
     */
    public function parseWebhook(Request $request): PaymentResult;

    /**
     * Rembourse un paiement confirmé ; lève une exception si le fournisseur refuse.
     */
    public function refund(Payment $payment): void;
}
