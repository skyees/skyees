 import React, {useState} from 'react';
import {View,Text,KeyboardAvoidingView,StyleSheet,TouchableOpacity,Alert,ActivityIndicator, Platform,Linking} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskInput from 'react-native-mask-input';
import Colors from '@/constants/Colors';
import { router } from 'expo-router';
import { isClerkAPIResponseError, useSignIn, useSignUp } from '@clerk/clerk-expo';
 
const IND_PHONE = [
  `+`,
  /\d/,
  /\d/,
  ' ',
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  ' ',
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
  /\d/,
];


const otp = () => {
const [loading,setLoading] = useState(true);
const [phoneNumber, setPhoneNumber] = useState('');
const keyboardVerticalOffset = Platform.OS === 'ios' ? 90 : 0;

 const { signUp, setActive } = useSignUp();

  const { signIn } = useSignIn();


   const openLink = () => {
    Linking.openURL('https://galaxies.dev');
  };

   const sendOTP = async () => {
    console.log('sendOTP', phoneNumber);
    setLoading(true);

    try {
      await signUp!.create({
        phoneNumber,
      });
      console.log('TESafter createT: ', signUp!.createdSessionId);

      signUp!.preparePhoneNumberVerification();

      console.log('after prepare: ');
      router.push(`/verify/${phoneNumber}`);
    } catch (err) {
      console.log('error', JSON.stringify(err, null, 2));

      if (isClerkAPIResponseError(err)) {
        if (err.errors[0].code === 'form_identifier_exists') {
          // User signed up before
          console.log('User signed up before');
          await trySignIn();
        } else {
          setLoading(false);
          Alert.alert('Error', err.errors[0].message);
        }
      }
    }
  };

  const trySignIn = async () => {
    console.log('trySignIn', phoneNumber);

    const { supportedFirstFactors } = await signIn!.create({
      identifier: phoneNumber,
    });

    const firstPhoneFactor: any = supportedFirstFactors.find((factor: any) => {
      return factor.strategy === 'phone_code';
    });

    const { phoneNumberId } = firstPhoneFactor;

    await signIn!.prepareFirstFactor({
      strategy: 'phone_code',
      phoneNumberId,
    });

    router.push(`/verify/${phoneNumber}?signin=true`);
    setLoading(false);
  };
  
 const bottom = useSafeAreaInsets();
   return (
     <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardVerticalOffset} style={{flex:1}}>
       <View style={Styles.container}>
        {!loading && (<View style={[StyleSheet.absoluteFill,Styles.loading]}>
          <ActivityIndicator size="large" color={Colors.primary}/>
          <Text style={{fontSize:18, padding:10}}>Sending Code...</Text>
          </View>)}
        <Text style={Styles.description}>
          WhatsApp will need verify your account. Carrier charges may apply. 
        </Text>
       
        <View style={Styles.list}>
          <View style={Styles.listItem}>
            <Text>India</Text>
            <Ionicons name="chevron-forward" size={20}></Ionicons>
          </View>
          <View style={Styles.separator}></View>
              <MaskInput
                style={Styles.input}
                keyboardType="numeric"
                autoFocus
                placeholder="+91 your phone number"
                value={phoneNumber}
                onChangeText={(masked, unmasked) => {
                setPhoneNumber(masked); // you can use the unmasked value as well
               }}
                mask={IND_PHONE} />
          </View>
        <Text style={Styles.legal}>
          You must be {' '}
          <Text style={Styles.link}>
            at least 16 years old
          </Text>{' '}
            to register, learn how WhatsApp works with the{' '}
          <Text style={Styles.link} onPress={openLink}>
          Meta Compaines
          </Text>
      </Text>
      <View style={{flex:1}}></View>
      <TouchableOpacity style={[Styles.button, phoneNumber != ''? Styles.enabled:null,{ marginBottom: 20}]} onPress={sendOTP} disabled={phoneNumber===''}>
        <Text style={[Styles.buttonText,phoneNumber != ''? Styles.enabled:null]}>Next</Text>
      </TouchableOpacity>
      </View>
      
     </KeyboardAvoidingView>
   )
 }
  const Styles = StyleSheet.create({
  
  container:{
  flex:1,
  alignItems:'center',
  padding:20,
  backgroundColor:Colors.background,
  gap:20
   },
   description:{
   fontSize:14,
   color:Colors.gray,
   },
   list:{
    backgroundColor:'#fff',
    width:'100%',
    borderRadius:10,
    padding:10,
   },
   listItem:{
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    padding:6,
    marginBottom:10,
   },
   listItemText:{
    fontSize:18,
    color:Colors.primary,
   },
   separator:{
    width:'100%',
    height:StyleSheet.hairlineWidth,
    backgroundColor:Colors.gray,
    opacity:0.5
   },
   legal:{
    fontSize:12,
    alignItems:'center',
    textAlign:'center',
    color:'#000'
     },
     link:{
      color:Colors.primary,
     },
     button:{
      width:'100%',
      alignItems:'center',
      backgroundColor:Colors.lightGray,
      padding:10,
      borderRadius:10,
     },
     buttonText:{
     color:Colors.gray,
     fontSize:22,
     fontWeight:'500'
     },
     enabled:{
      backgroundColor:Colors.primary,
      color:'#fff'
     },
     input:{
      backgroundColor:'#fff',
      width:'100%',
      fontSize:16,
      padding:6,
      marginTop:10,
     },
     loading:{
      ...StyleSheet.absoluteFillObject,
      zIndex:10,
      backgroundColor:'#fff',
      justifyContent:'center',
      alignItems:'center'
     }
    
  });
export default otp;