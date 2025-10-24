
import React from 'react';
import { Link }from 'expo-router';
import { Text ,View, Image, StyleSheet ,TouchableOpacity} from 'react-native';
import Colors from "@/constants/Colors";

const index = () => {

 const openLink = () =>{

 }
  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/welcome.png")} style={styles.welcome}/>
      <Text style={styles.headline}>Welome To WhatsApp Clone</Text>
      <Text style={styles.description}>
      Read our {" "}
       <Text style={styles.link} onPress={openLink}> 
        Privacy policy
      </Text>
      .{'Tap "Agree & Continue" to accept the '}
      <Text style={styles.link} onPress={openLink}>
        Terms of Service.
      
       </Text>
       </Text>
      <Link href = '/otp' asChild>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}> Agree & Continue</Text>
      </TouchableOpacity>
      </Link>
     
    </View>
  );
}
const styles = StyleSheet.create({
container:{
  flex:1,
  padding:20,
  justifyContent:'center',
  alignItems:'center',
  backgroundColor:'#fff',

},

headline:{
fontSize:24,
fontWeight:'600',
marginVertical:80,
},

welcome:{
 width:'100%',
 height:300,
 marginBottom:40,

} ,
description:{
fontSize:14,
textAlign:'center',
marginBottom:80,
color:Colors.gray,
},
link:{
 color:Colors.primary,
} ,
button:{
  width:'100%',
  alignItems:'center',
  },
buttonText:{
  fontSize:22,
  color:Colors.primary,
  fontWeight: 'bold'
   }
}); 

export default index;