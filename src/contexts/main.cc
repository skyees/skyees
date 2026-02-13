#include <node.h>

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

// This is the function that will be called from JavaScript
void Method(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  // Returns the string "world"
  args.GetReturnValue().Set(String::NewFromUtf8(
      isolate, "world").ToLocalChecked());
}

// This initializes the module
void Initialize(Local<Object> exports) {
  // Exposes the function "Method" as "hello" in JavaScript
  NODE_SET_METHOD(exports, "hello", Method);
}

// Registers the module
NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo