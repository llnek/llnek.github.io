/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  const int=Math.floor;

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  function scenes(Mojo){

    const {Sprites:_S,
           Scenes:_Z,
           FX:_F,
           Ute2D:_U,
           Input:_I,
           Game:_G,
           math:_M,
           v2:_V,
           ute:_,is}=Mojo;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      Core= window["io/czlab/mcfud/core"](),
      GA= window["io/czlab/mcfud/algo/NNetGA"](Core);

    ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      READY  = 4,
      TRAINING = 1,
      ACTIVE   = 2,
      LEARNING = 3,
      NUM_INPUTS=12,
      NUM_OUTPUTS=11,
      NEURONS_PER_HIDDEN=6;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;

		//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Supervised Learning",
        action: {name:"PlayGame"},
        clickSnd:"click.mp3",
      };

    const VECNAMES= ["Right", "Left", "Down", "Up",
					           "CW Square", "CCW Square",
								     "Right Arrow", "Left Arrow", "South West", "South East", "Zorro"];

		//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
		function CData(){
			const vecPatterns= [[1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0],
											[-1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0],
											[0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0, 0,1.0],
											[0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0, 0,-1.0],
											[1.0,0, 1.0,0, 1.0,0, 0,1.0, 0,1.0, 0,1.0, -1.0,0, -1.0,0, -1.0,0, 0,-1.0, 0,-1.0, 0,-1.0],
											[-1.0,0, -1.0,0, -1.0,0, 0,1.0, 0,1.0, 0,1.0, 1.0,0, 1.0,0, 1.0,0, 0,-1.0, 0,-1.0, 0,-1.0],
											[1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0, -0.45,0.9, -0.9, 0.45, -0.9,0.45],
											[-1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, -1.0,0, 0.45,0.9, 0.9, 0.45, 0.9,0.45],
											[-0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7, -0.7,0.7],
											[0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7, 0.7,0.7],
											[1.0,0, 1.0,0, 1.0,0, 1.0,0, -0.72,0.69,-0.7,0.72,0.59,0.81, 1.0,0, 1.0,0, 1.0,0, 1.0,0, 1.0,0]];
			const setIn=vecPatterns.slice(),
				    numPatterns= vecPatterns.length,
				    setOut=_.fill(numPatterns,(i,o)=>{
							o=_.fill(numPatterns,0); o[i] = 1; return o; });
			return{
				setIn, //11x12,
				setOut,//11x11
				numPatterns,
				vecNames: VECNAMES,
				patternName(i){
					try{
						return this.vecNames[i]
					}catch(e){
						return "Unknown pattern"
					}
				}
			};
		}

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function networkTrainingCycle(nnet, learnRate, setIn, setOut){
      nnet.errorSum = 0;
      for(let err,outputs,vec=0;vec<setIn.length;++vec){
        outputs = nnet.update(setIn[vec]);
        if(outputs.length==0) return false;
        for(let u,ws,op=0;op<nnet.numOutputs;++op){
          err = (setOut[vec][op] - outputs[op]) * outputs[op] * (1 - outputs[op]);
          u=nnet.getLayer(1).neuronAt(op);
          ws=u.weights;
          u.error = err;
          nnet.errorSum += (setOut[vec][op] - outputs[op]) * (setOut[vec][op] - outputs[op]);

          u.iterWeights((w,i,arr)=>{
            //skip bias
            if(i< arr.length-1)
              arr[i] += err*learnRate*nnet.getLayer(0).neuronAt(i).activation;
          });

          u.setBias(u.getBias() + err * learnRate * _G.params.BIAS);
        }

        for(let i=0;i<nnet.getLayer(0).numNeurons; ++i){
          err = 0;
          for(let j=0;j<nnet.getLayer(1).numNeurons; ++j){
            err += nnet.getLayer(1).neuronAt(j).error * nnet.getLayer(1).neuronAt(j).getWeight(i);
          }
          err *= nnet.getLayer(0).neuronAt(i).activation * (1-nnet.getLayer(0).neuronAt(i).activation);

          for(let w=0;w<nnet.numInputs;++w)
            nnet.getLayer(0).neuronAt(i).setWeight(w,
              nnet.getLayer(0).neuronAt(i).getWeight(w) + err * learnRate * setIn[vec][w]);

          nnet.getLayer(0).neuronAt(i).setWeight(nnet.numInputs,
            nnet.getLayer(0).neuronAt(i).getWeight(nnet.numInputs) + err * _G.params.BIAS);
        }
      }
      return true;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function train(nnet,learnRate,data,async){
      let {setIn,setOut} = data;
      _.assert(setIn.length == setOut.length &&
               setIn[0].length == nnet.numInputs &&
               setOut[0].length == nnet.numOutputs, "Inputs/Outputs length is invalid.");
      //initNetwork()
      nnet.errorSum = 9999.9;
      nnet.trainCycles = 0;
      nnet.trained=false;
      nnet.iterLayers((y)=>{
        y.iterNeurons((u)=>{
          u.iterWeights((w,i,arr)=>{
            arr[i]= _.randMinus1To1()
          })
        })
      });
      //
      async.run((count=100,extra=null)=>{
        let s;
        for(let i=0;i<count && !nnet.trained; ++i){
          let ok= networkTrainingCycle(nnet, learnRate,setIn, setOut);
          if(!ok){
            Mojo.CON.log(`Ooopss..... bad training`);
          }
          nnet.trainCycles += 1;
          s=`Epoch: ${nnet.trainCycles}, ErrorSum: ${nnet.errorSum}`;
          Mojo.CON.log(s);
          if(nnet.errorSum>0.003){}else{
            Mojo.CON.log(`trained-ok`);
            nnet.trained=true;
          }
          extra.text=s;
        }
        return nnet.trained;
      });
      if(false){
        while(nnet.errorSum>0.003){
          if(!networkTrainingCycle(nnet,learnRate,setIn, setOut)) return false;
          nnet.trainCycles += 1;
        }
        return nnet.trained = true;
      }
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    _Z.scene("PlayGame",{
      setup(){
        const
          self=this,
          K=Mojo.getScaleFactor();
        _.inject(this.g,{
          showTitle(){
            let s=_S.bmpText("AI is trained :)",UI_FONT,24*K);
            _S.pinAbove(_G.arena,s,s.height);
            self.insert(this.title=s);
            this.gfx= self.insert(_S.graphics());
          },
          initLevel(){
            let s,verb= Mojo.touchDevice?"Tap":"Click";
            _G.data = CData();
            _G.pmap={};
            _G.nnet = new GA.NeuralNet(2*NUM_INPUTS, NUM_OUTPUTS, [1,NEURONS_PER_HIDDEN]);
            this.numSmoothPoints = NUM_INPUTS+1;
            this.highestOutput = 0;
            this.bestMatch = 0;
            this.match = -1;
            this.drawing = false;
            this.clear();
            s=_S.bmpText(`${verb} to train the AI...`,UI_FONT,24*K);
            _S.centerAnchor(s);
            _V.set(s,Mojo.width/2,Mojo.height/2);
            self.insert(s);
            function cb(){
              _I.off(["single.tap"],cb);
              _S.hide(s);
              playClick();
              _.delay(0,()=> _Z.modal("Trainer"),{
              });
            }
            _I.on(["single.tap"],cb);
            /////
            let m=this.msgText=_S.bmpText(" ",UI_FONT,24*K);
            _S.pinBelow(_G.arena,m,-m.height*2);
            _S.centerAnchor(m);
            _S.hide( self.insert(m));
          },
          clear(){
            this.vectors = [];
            this.path = [];
            this.smoothPath = [];
          },
          testForMatch(){
            let outputs = _G.nnet.update(this.vectors);
            if(outputs.length == 0){
              Mojo.CON.log("Error in with ANN output");
              return false;
            }
            this.highestOutput = 0;
            this.bestMatch = 0;
            this.match = -1;
            for(let i=0;i<outputs.length;++i){
              if(outputs[i] > this.highestOutput){
                this.highestOutput = outputs[i];
                this.bestMatch = i;
                if(this.highestOutput > 0.96)// MATCH_TOLERANCE
                  this.match = this.bestMatch;
              }
            }
            _.log(`highest=${this.highestOutput}, best=${this.bestMatch}, match= ${this.match}`);
            return true;
          },
          createVectors(){
            for(let i=1;i<this.smoothPath.length;++i){
              let x = this.smoothPath[i][0] - this.smoothPath[i-1][0];
              let y = this.smoothPath[i][1] - this.smoothPath[i-1][1];
              let v2 = [x,y];
              _V.unit$(v2);
              this.vectors.push(v2[0]);
              this.vectors.push(v2[1]);
            }
          },
          smooth(){
            if(this.path.length < this.numSmoothPoints){
              _.log(`Length of Path not correct: ${this.path.length}, expected: ${this.numSmoothPoints}`);
              return false;
            }

            this.smoothPath = this.path.slice();

            while(this.smoothPath.length > this.numSmoothPoints){
              let shortestSoFar = Infinity;
              let pointMarker = 0;
              for(let spanFront=2; spanFront<this.smoothPath.length-1; ++spanFront){
                let xTmp = this.smoothPath[spanFront-1][0] - this.smoothPath[spanFront][0];
                let yTmp = this.smoothPath[spanFront-1][1] - this.smoothPath[spanFront][1];
                let length = Math.sqrt(xTmp*xTmp + yTmp*yTmp);
                if(length < shortestSoFar){
                  shortestSoFar = length;
                  pointMarker = spanFront;
                }
              }

              let newPoint = [(this.smoothPath[pointMarker-1][0] + this.smoothPath[pointMarker][0])/2,
                              (this.smoothPath[pointMarker-1][1] + this.smoothPath[pointMarker][1])/2];

              this.smoothPath[pointMarker-1] = newPoint;
              this.smoothPath = this.smoothPath.slice(0,pointMarker).concat( this.smoothPath.slice(pointMarker+1));
            }
            return true;
          },
          addPoint(point){
            this.path.push(point)
          },
          isDrawing(){
            return this.drawing;
          },
          setDrawing(val){
            _.log(`setdraw called = ${val}, mode=${_G.mode}`);
            if(val === true){
              _.doseq(_G.pmap,v=>v.tint=_S.SomeColors.white);
              this.clear();
              this.playedSound=false;
              this.drawing = true;
              this.msgText.text="";
            }else{
              this.drawing=false;
              try{
                if(this.smooth()){
                  this.createVectors();
                  if(!this.testForMatch())
                    _.log( "Error when test for match");
                }else{
                  _.log(`NOT SMOOTH???????`);
                }
              }catch(e){
                _.log(e.toString());
              }
            }
          },
          paint(){
            if(!this.isDrawing()){
              if(this.highestOutput > 0){
                if(this.smoothPath.length > 1 && _G.mode != LEARNING){
                  let guess= _G.data.patternName(this.highestOutput<0.96?this.bestMatch:this.match);
                  _G.pmap[guess].tint=_S.BtnColors.green;
                  if(!this.playedSound){
                    Mojo.sound("coin.mp3").play();
                    this.playedSound=true;
                  }
                  if(this.highestOutput < 0.96){ //#MATCH_TOLERANCE
                    //this.msgText.text=`Gesture = ${_G.data.patternName(this.bestMatch)}?`;
                  }else{
                    //this.msgText.text= `Gesture = ${_G.data.patternName(this.match)}`;
                  }
                }else if(_G.mode != LEARNING){
                  _.log(`Not enough points drawn - plz try again`);
                }
              }
            }
            if(this.path.length < 2){return}
            this.gfx.clear();
            for(let p,i=0,z=this.path.length; i<z;++i){
              p=this.path[i];
              this.gfx.moveTo(p[0],p[1]);
              if((i+1)<z){
                p=this.path[i+1];
              }
              this.gfx.lineTo(p[0],p[1]);
            }
            this.gfx.stroke({width:1,color:_S.SomeColors.white});
            if(!this.isDrawing() && this.smoothPath.length>0){
              for(let p,i=0;i<this.smoothPath.length;++i){
                p=this.smoothPath[i];
                this.gfx.circle(p[0],p[1],5);
                this.gfx.stroke({width:1,color:_S.BtnColors.red});
              }
            }
          },
          onMouseDown(){
            if(_G.mode==ACTIVE) self.g.setDrawing(true);
          },
          onMouseUp(){
            if(_G.mode==ACTIVE) self.g.setDrawing(false);
          },
          onMouseMove(){
            if(_G.mode==ACTIVE &&
               self.g.isDrawing()){
              self.g.addPoint([ Mojo.mouse.x, Mojo.mouse.y])
            }
          }
        });
        _G.params= GA.config({});
        if(1){
          let b,s,out={};
          _S.gridSQ(10,0.8,out);
          _G.arena=out;
          self.insert(_S.bboxFrame(out));
        }
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        this.g.initLevel();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        if(1){
          let p,s;
          VECNAMES.forEach(n=>{
            s=_S.bmpText(n,{fontName:UI_FONT, fontSize:24*K,align:"left"});
            _G.pmap[n]=s;
            if(!p){
              _S.pinAbove(_G.arena,s,-40*K,0);
              s.x += 10*K;
            }else{
              _S.pinBelow(p,s,24*K,0);
            }
            p=self.insert(s);
            _S.hide(p);
          });
        }
      },
      dispose(){
        if(Mojo.touchDevice){
          _I.off(["touchstart"], "onMouseDown", this.g);
          _I.off(["touchend"], "onMouseUp", this.g);
          _I.off(["touchmove"], "onMouseMove", this.g);
        }else{
          _I.off(["mousedown"], "onMouseDown", this.g);
          _I.off(["mouseup"], "onMouseUp", this.g);
          _I.off(["mousemove"], "onMouseMove", this.g);
        }
      },
      postUpdate(dt){
        if(_G.mode==READY){
          _S.show(this.g.msgText);
          this.g.showTitle();
          _G.mode=ACTIVE;
          _.doseq(_G.pmap,v=>_S.show(v));
          if(Mojo.touchDevice){
            _I.on(["touchstart"], "onMouseDown", this.g);
            _I.on(["touchend"], "onMouseUp", this.g);
            _I.on(["touchmove"], "onMouseMove", this.g);
          }else{
            _I.on(["mousedown"], "onMouseDown", this.g);
            _I.on(["mouseup"], "onMouseUp", this.g);
            _I.on(["mousemove"], "onMouseMove", this.g);
          }
        }
        else
        if(_G.mode==ACTIVE){
          this.g.paint();
        }
      }
    });

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    _Z.scene("Trainer",{
      setup(){
        let
          self=this,
          K=Mojo.getScaleFactor(),
          os={fontName:UI_FONT,fontSize:24*K},
          space=()=> _S.opacity(_S.bmpText("I",os),0),
          s1=_S.bmpText("Training in progress", os),
          s2=_S.bmpText("Please wait...", os),
          s4=_S.bmpText(" ",os),
          s5=_S.bmpText(" ",os),
          s6=_S.bmpText("ready!",os);
        let y;
        this.insert(y=_Z.layoutY([s1,s2,space(),s4,s6],{bg:"transparent"}));
        s6.tint=_S.BtnColors.green;
        _S.hide(s6);
        this.g.readyBtn=s6;
        _S.centerAnchor(s5);
        _S.pinBelow(y,s5,s5.height);
        self.insert(this.g.status=s5);
      },
      postUpdate(){
        let self=this;
        if(this.g.mode === UNDEF){
          _.delay(0,()=>{
            let cb=0;
            train(_G.nnet, 0.5, _G.data,{ run(c){ cb=c } });
            this.g.trainingFunc=cb;
            this.g.mode =TRAINING;
          })
        }
        if(this.g.trainingFunc){
          _.log("Training in progress.......................");
          let ok=this.g.trainingFunc(100,this.g.status);
          function cb(){
            _I.off(["single.tap"],cb);
            _Z.remove(self);
            playClick();
            _G.mode=READY;
          }
          if(ok){
            this.g.trainingFunc=UNDEF;
            this.g.mode=ACTIVE;
            _S.hide(this.g.status);
            _S.show(this.g.readyBtn);
            _I.on(["single.tap"],cb);
          }
        }
      }
    });


    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["click.mp3","coin.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    //scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);


