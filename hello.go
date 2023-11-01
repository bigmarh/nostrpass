package main

import (
    "fmt"
    "crypto/ecdsa"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "github.com/dustinxie/ecc"
    "crypto/elliptic"
    "syscall/js"
    "math/big"

)

var (
      p256k1 = ecc.P256k1()
)

func GenerateKeys (this js.Value, args []js.Value) interface{}{
   
    privateKey, err := ecdsa.GenerateKey(p256k1, rand.Reader);
    if err != nil {
        fmt.Println("Error generating private key:", err)
        return err;
    }
    privateKeyBytes := privateKey.D.Bytes()
    privateKeyHex := hex.EncodeToString(privateKeyBytes)
    return privateKeyHex;
}

func getPublicKey(this js.Value, args []js.Value) interface{}{
    return _getPublicKey(args[0].String())
} 

func sign(this js.Value, args []js.Value) interface{} {
    return _sign(args[0].String(),args[1].String());
}


func getHash(this js.Value, args []js.Value) interface{}{
    hash := sha256.Sum256([]byte(args[0].String()));
    return hex.EncodeToString(hash[:]);
}


func verifySign(this js.Value, args []js.Value) interface{} {
    return _verifySign(args[0].String(),args[1].String(),args[2].String());
}

func _verifySign( msg string, sig string, publicKey string) bool{

    hash := sha256.Sum256([]byte(msg));
    pubKey := new(ecdsa.PublicKey);
    pubKeyBytes, err := hex.DecodeString(publicKey);
    if err != nil {
        fmt.Println("Error generating public key bytes:", err)
    }

    sigBytes, err := hex.DecodeString(sig);
    if err != nil {
        fmt.Println(err)
    }
    pubKey.X, pubKey.Y = elliptic.Unmarshal(p256k1,pubKeyBytes);
    pubKey.Curve = p256k1;
   
    return ecc.VerifyBytes(pubKey, hash[:], sigBytes, ecc.Normal)
}

func _getPublicKey(privateKeyHex string) string{



     bytes, err := hex.DecodeString(privateKeyHex);
     if err != nil {
        fmt.Println(err)
    }

    k := new(big.Int)
    k.SetBytes(bytes)

    priv := new(ecdsa.PrivateKey);
    priv.D = k;

    pubKey := priv.PublicKey
    curve := p256k1
    pubKey.Curve = curve
    pubKey.X, pubKey.Y = curve.ScalarBaseMult(k.Bytes())
    pubKeyBytes := elliptic.Marshal(p256k1, pubKey.X, pubKey.Y);
    pubKeyHex := hex.EncodeToString(pubKeyBytes);

    return pubKeyHex;
}


func _sign (privateKeyHex string, msg string) string{

     bytes, err := hex.DecodeString(privateKeyHex);
     if err != nil {
        fmt.Println(err)
    }

    k := new(big.Int)
    k.SetBytes(bytes)

    priv := new(ecdsa.PrivateKey);
    priv.D = k;
    curve := p256k1
    priv.PublicKey.Curve = curve
    priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(k.Bytes())
    hash := sha256.Sum256([]byte(msg))
    sig, err := ecc.SignBytes(priv, hash[:], ecc.Normal);
    if err != nil {
        fmt.Println(err)
    }

   return hex.EncodeToString(sig);
}


 


func main() {
    c:= make(chan int);
    jsObj := map[string]interface{}{}; 
    js.Global().Set("KeyHelper", js.ValueOf(jsObj));
    js.Global().Get("KeyHelper").Set("getHash",js.FuncOf(getHash))
    js.Global().Get("KeyHelper").Set("GenerateKeys",js.FuncOf(GenerateKeys))
    js.Global().Get("KeyHelper").Set("getPublicKey",js.FuncOf(getPublicKey))
    js.Global().Get("KeyHelper").Set("sign",js.FuncOf(sign))
    js.Global().Get("KeyHelper").Set("verifySign",js.FuncOf(verifySign))
    <-c
     /*   privateKey, err := ecdsa.GenerateKey(p256k1, rand.Reader)
    if err != nil {
        fmt.Println("Error generating private key:", err)
        return
    }

    publicKey := privateKey.PublicKey
    publicKeyBytes := elliptic.Marshal(p256k1, publicKey.X, publicKey.Y)
    publicKeyHex := hex.EncodeToString(publicKeyBytes)

    // Serialize private key to hex
    privateKeyBytes := privateKey.D.Bytes()
    privateKeyHex := hex.EncodeToString(privateKeyBytes)

    hash := sha256.Sum256([]byte("Peace"))
    sig, err := ecc.SignBytes(privateKey, hash[:], ecc.Normal);
    if err != nil {
        fmt.Println(err)
    }*/

    
 
    // Print the keys to test
  /*fmt.Println("Private Key (hex):", privateKeyHex)
    fmt.Println("Public Key (hex):",publicKeyHex )
    fmt.Println("Public Key (hex):",_getPublicKey(privateKeyHex))
    fmt.Println("Signature of 'Peace':",hex.EncodeToString(sig));
    fmt.Println("Signture Verified:", ecc.VerifyBytes(&publicKey, hash[:], sig, ecc.Normal))*/
  
}


